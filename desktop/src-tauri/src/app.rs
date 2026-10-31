use std::collections::{HashSet, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::config::Config;
use crate::keyboard::KeyboardSimulator;
use crate::mouse::MouseSimulator;
use crate::realtime::{spawn_realtime, RealtimeCommand};
use crate::session::{channel_name, generate_session_id, pairing_url, realtime_topic, realtime_ws_url};
use crate::types::{
    ClientInfo, HistoryItem, KeyEventPayload, MouseEventPayload, PendingClient, SessionInfo,
    Stats, TypeTextPayload, UiSnapshot,
};

/// If the mobile goes silent for this long, fall back to waiting_pairing.
const MOBILE_PRESENCE_TIMEOUT_SECS: u64 = 60;
/// Broadcast the current presence this often so mobile clients can tell the
/// link is still end-to-end alive (channel subscription alone is not a
/// liveness signal on either side).
const STATUS_BROADCAST_INTERVAL_SECS: u64 = 10;

/// Remote input hardening: values a phone can push into the OS are bounded so
/// a buggy or hostile client cannot fling the cursor or flood the machine.
const MAX_MOUSE_DELTA: i32 = 200;
const MAX_SCROLL_DELTA: i32 = 20;
const MAX_TYPE_TEXT_CHARS: usize = 8192;
const INPUT_RATE_PER_SEC: f64 = 250.0;
const INPUT_RATE_BURST: f64 = 500.0;

/// Token bucket limiting how many input events one session can inject.
pub struct RateLimiter {
    tokens: f64,
    last: Instant,
}

impl RateLimiter {
    fn new() -> Self {
        Self {
            tokens: INPUT_RATE_BURST,
            last: Instant::now(),
        }
    }

    fn allow(&mut self) -> bool {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last).as_secs_f64();
        self.last = now;
        self.tokens = (self.tokens + elapsed * INPUT_RATE_PER_SEC).min(INPUT_RATE_BURST);
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }

    fn reset(&mut self) {
        self.tokens = INPUT_RATE_BURST;
        self.last = Instant::now();
    }
}

pub struct AppState {
    pub inner: Arc<AppInner>,
}

/// The currently linked mobile client. `connected_at` is preserved while the
/// same pairing stays alive (the mobile regenerates its client id on reload).
pub struct ClientLink {
    pub id: String,
    pub connected_at: Instant,
    pub approximate: bool,
    /// Browser tab that last spoke for this client. Used to ignore a stale
    /// `client_left` from a tab that was replaced by another live one.
    pub tab_id: Option<String>,
}

/// A phone that scanned the QR but has not been approved by the desktop user
/// yet. Input from it is dropped until `resolve_pairing` accepts it.
pub struct PendingClientLink {
    pub id: String,
    pub requested_at: Instant,
}

pub struct AppInner {
    pub config: Config,
    pub session_id: Mutex<String>,
    pub paused: AtomicBool,
    /// True when `paused` came from auto-pause (idle), not a manual toggle.
    pub auto_paused: AtomicBool,
    /// Idle timeout for auto-pause in ms (0 disables it). Starts from the
    /// config/env default and can be changed from the helper UI.
    pub auto_pause_ms: AtomicU64,
    pub keyboard: KeyboardSimulator,
    pub mouse: MouseSimulator,
    pub history: Mutex<VecDeque<HistoryItem>>,
    pub dedup: Mutex<HashSet<String>>,
    /// Client ids the desktop user accepted for the current session.
    pub approved: Mutex<HashSet<String>>,
    /// Client ids the desktop user rejected; ignored until the session rotates.
    pub denied: Mutex<HashSet<String>>,
    pub pending: Mutex<Option<PendingClientLink>>,
    pub rate: Mutex<RateLimiter>,
    pub cmd_tx: Mutex<Option<tokio::sync::mpsc::Sender<RealtimeCommand>>>,
    pub out_rx: Mutex<Option<tokio::sync::mpsc::Receiver<Value>>>,
    pub realtime_abort: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    pub loop_abort: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    pub pairing_url: Mutex<String>,
    pub last_activity: Mutex<Instant>,
    pub last_mobile_at: Mutex<Instant>,
    pub last_presence: Mutex<String>,
    pub last_status_sent: Mutex<Instant>,
    pub init_started: AtomicBool,
    pub client: Mutex<Option<ClientLink>>,
    pub stats: Mutex<Stats>,
    pub stats_dirty: AtomicBool,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        let auto_pause_ms = config.auto_pause_after_ms;
        AppState {
            inner: Arc::new(AppInner {
                config,
                session_id: Mutex::new(generate_session_id()),
                paused: AtomicBool::new(false),
                auto_paused: AtomicBool::new(false),
                auto_pause_ms: AtomicU64::new(auto_pause_ms),
                keyboard: KeyboardSimulator::new(),
                mouse: MouseSimulator::new(),
                history: Mutex::new(VecDeque::with_capacity(100)),
                dedup: Mutex::new(HashSet::new()),
                approved: Mutex::new(HashSet::new()),
                denied: Mutex::new(HashSet::new()),
                pending: Mutex::new(None),
                rate: Mutex::new(RateLimiter::new()),
                cmd_tx: Mutex::new(None),
                out_rx: Mutex::new(None),
                realtime_abort: Mutex::new(None),
                loop_abort: Mutex::new(None),
                pairing_url: Mutex::new(String::new()),
                last_activity: Mutex::new(Instant::now()),
                last_mobile_at: Mutex::new(Instant::now()),
                last_presence: Mutex::new(String::new()),
                last_status_sent: Mutex::new(Instant::now()),
                init_started: AtomicBool::new(false),
                client: Mutex::new(None),
                stats: Mutex::new(Stats::default()),
                stats_dirty: AtomicBool::new(false),
            }),
        }
    }

    fn restart_realtime(&self, app: &AppHandle) -> Result<(), String> {
        let session_id = self.inner.session_id.lock().unwrap_or_else(|e| e.into_inner()).clone();
        let channel = channel_name(&session_id);
        *self.inner.pairing_url.lock().unwrap_or_else(|e| e.into_inner()) =
            pairing_url(&self.inner.config.pairing_base_url, &session_id);

        eprintln!(
            "[airtype] init realtime configured={} url_host={:?}",
            self.inner.config.is_configured(),
            self.inner.config.supabase_url.split('/').nth(2),
        );

        if !self.inner.config.is_configured() {
            return Err(
                "Supabase belum dikonfigurasi. Set AIRTYPE_SUPABASE_URL dan AIRTYPE_SUPABASE_ANON_KEY."
                    .into(),
            );
        }

        let ws_url = realtime_ws_url(
            &self.inner.config.supabase_url,
            &self.inner.config.supabase_anon_key,
        );

        let (out_tx, out_rx) = tokio::sync::mpsc::channel(256);
        let (cmd_tx, cmd_rx) = tokio::sync::mpsc::channel(64);
        *self.inner.cmd_tx.lock().unwrap_or_else(|e| e.into_inner()) = Some(cmd_tx);
        *self.inner.out_rx.lock().unwrap_or_else(|e| e.into_inner()) = Some(out_rx);

        // Abort any previous realtime task so we never accumulate zombie
        // websocket connections (they could exhaust the connection budget and
        // make the live link drop).
        if let Some(prev) = self.inner.realtime_abort.lock().unwrap_or_else(|e| e.into_inner()).take() {
            prev.abort();
        }
        let handle = spawn_realtime(
            ws_url,
            realtime_topic(&channel),
            session_id,
            self.inner.config.supabase_anon_key.clone(),
            out_tx,
            cmd_rx,
        );
        *self.inner.realtime_abort.lock().unwrap_or_else(|e| e.into_inner()) = Some(handle);

        self.start_message_loop(app);
        emit_status(app, "subscribing");
        Ok(())
    }

    fn start_message_loop(&self, app: &AppHandle) {
        if let Some(prev) = self.inner.loop_abort.lock().unwrap_or_else(|e| e.into_inner()).take() {
            prev.abort();
        }
        let rx = match self.inner.out_rx.lock().unwrap_or_else(|e| e.into_inner()).take() {
            Some(rx) => rx,
            None => return,
        };
        let inner = self.inner.clone();
        let app2 = app.clone();
        let handle = tauri::async_runtime::spawn(async move {
            let mut rx = rx;
            while let Some(value) = rx.recv().await {
                // A panic here used to kill this task permanently, silently
                // dropping every later key/mouse event while the connection
                // still looked healthy ("connected but unresponsive"). Catch
                // it so the loop keeps draining incoming messages.
                let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                    handle_incoming(&inner, &app2, value);
                }));
                if result.is_err() {
                    eprintln!("[airtype] recovered from panic in handle_incoming");
                }
            }
        });
        *self.inner.loop_abort.lock().unwrap_or_else(|e| e.into_inner()) = Some(handle);
    }
}

#[tauri::command]
pub fn init_app(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    if state.inner.init_started.swap(true, Ordering::SeqCst) {
        return Ok(());
    }
    // Show the window first so the UI is always visible, even if the
    // realtime connection cannot be established (frontend displays the error).
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
    state.restart_realtime(&app)?;

    let inner = state.inner.clone();
    let app2 = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;

            // Periodic liveness broadcast: mobile clients treat an inbound
            // desktop_status as "the link is still alive" even when the state
            // never changes. Broadcast the current presence every interval so
            // a silently dead half-open connection surfaces on the phone.
            {
                let mut last = inner
                    .last_status_sent
                    .lock()
                    .unwrap_or_else(|e| e.into_inner());
                if last.elapsed() >= Duration::from_secs(STATUS_BROADCAST_INTERVAL_SECS) {
                    *last = Instant::now();
                    let status = inner
                        .last_presence
                        .lock()
                        .unwrap_or_else(|e| e.into_inner())
                        .clone();
                    if !status.is_empty() {
                        broadcast_status(&inner, &status);
                    }
                    // Re-ask while a request is still unanswered, so a phone
                    // that missed the first approval_required (or a window
                    // opened later) still sees the prompt.
                    let pending_id = inner
                        .pending
                        .lock()
                        .unwrap_or_else(|e| e.into_inner())
                        .as_ref()
                        .map(|p| p.id.clone());
                    if let Some(id) = pending_id {
                        broadcast_approval_required(&inner, &id);
                    }
                }
            }

            // Presence watchdog: if the mobile has been silent for too long,
            // fall back to waiting_pairing (handles mobile dying without client_left).
            if !inner.paused.load(Ordering::SeqCst) {
                let mobile_idle = inner.last_mobile_at.lock().unwrap_or_else(|e| e.into_inner()).elapsed().as_secs();
                if mobile_idle > MOBILE_PRESENCE_TIMEOUT_SECS {
                    clear_pending(&inner, &app2);
                    clear_client(&inner, &app2);
                    set_presence(&inner, &app2, "waiting_pairing");
                }
            }

            // Stats are incremented per event but flushed here at most once a
            // second; otherwise touchpad moves would flood the IPC channel.
            if inner.stats_dirty.swap(false, Ordering::SeqCst) {
                emit_stats(&inner, &app2);
            }

            let timeout = inner.auto_pause_ms.load(Ordering::SeqCst);
            if timeout == 0 {
                continue;
            }
            let idle = inner.last_activity.lock().unwrap_or_else(|e| e.into_inner()).elapsed().as_millis() as u64;
            if idle > timeout && !inner.paused.load(Ordering::SeqCst) {
                inner.paused.store(true, Ordering::SeqCst);
                inner.auto_paused.store(true, Ordering::SeqCst);
                inner.keyboard.release_all();
                *inner.last_presence.lock().unwrap_or_else(|e| e.into_inner()) = "paused".to_string();
                let _ = app2.emit("airtype:status", "paused");
                broadcast_status(&inner, "paused");
            }
        }
    });
    Ok(())
}

#[tauri::command]
pub async fn new_session(app: AppHandle) -> Result<SessionInfo, String> {
    // Send session_ended on the old channel and wait until it is actually on
    // the wire before tearing the connection down. Rotating first used to
    // abort the realtime task while the broadcast was still queued, so phones
    // stayed on the keyboard screen.
    notify_session_end(&app).await;

    let state = app.state::<AppState>();
    *state.inner.session_id.lock().unwrap_or_else(|e| e.into_inner()) = generate_session_id();
    state.inner.dedup.lock().unwrap_or_else(|e| e.into_inner()).clear();
    // Approvals are scoped to a session: a new QR means a new pairing round.
    state.inner.approved.lock().unwrap_or_else(|e| e.into_inner()).clear();
    state.inner.denied.lock().unwrap_or_else(|e| e.into_inner()).clear();
    state.inner.pending.lock().unwrap_or_else(|e| e.into_inner()).take();
    state.inner.rate.lock().unwrap_or_else(|e| e.into_inner()).reset();

    // Never carry presence/client/stats from the previous session: otherwise
    // the fresh session would briefly report "connected" for a phone that is
    // still linked to the old channel.
    *state.inner.last_presence.lock().unwrap_or_else(|e| e.into_inner()) = "waiting_pairing".to_string();
    *state.inner.client.lock().unwrap_or_else(|e| e.into_inner()) = None;
    *state.inner.stats.lock().unwrap_or_else(|e| e.into_inner()) = Stats::default();
    state.inner.stats_dirty.store(false, Ordering::SeqCst);
    // Pairing rotates the session; keeping the previous feed around would leak
    // text typed in the old pairing into the new one.
    state.inner.history.lock().unwrap_or_else(|e| e.into_inner()).clear();
    // Rotating the session is an explicit "start over" action, so lift any
    // idle auto-pause (and a manual one) to avoid a fresh session that
    // silently swallows input.
    if state.inner.paused.swap(false, Ordering::SeqCst) {
        state.inner.auto_paused.store(false, Ordering::SeqCst);
        state.inner.keyboard.release_all();
    }
    *state.inner.last_activity.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();

    let _ = app.emit("airtype:client", Option::<ClientInfo>::None);
    let _ = app.emit("airtype:pending", Option::<PendingClient>::None);
    let _ = app.emit("airtype:stats", Stats::default());
    let _ = app.emit("airtype:history", Vec::<HistoryItem>::new());

    state.restart_realtime(&app)?;
    Ok(session_info(&state.inner))
}

#[tauri::command]
pub fn toggle_pause(app: AppHandle) -> bool {
    let state = app.state::<AppState>();
    let next = !state.inner.paused.load(Ordering::SeqCst);
    set_paused(&state.inner, &app, next);
    next
}

/// Change the idle auto-pause timeout (0 disables it). If the desktop is
/// currently auto-paused, changing the setting resumes it immediately so the
/// new value takes effect instead of leaving a stale pause behind.
#[tauri::command]
pub fn set_auto_pause(app: AppHandle, timeout_ms: u64) {
    let state = app.state::<AppState>();
    let clamped = timeout_ms.min(24 * 60 * 60 * 1000);
    state.inner.auto_pause_ms.store(clamped, Ordering::SeqCst);
    if state.inner.auto_paused.swap(false, Ordering::SeqCst) {
        set_paused(&state.inner, &app, false);
    }
}

/// Erase the activity feed. Typed text lives there, so a one-click clear
/// keeps sensitive input from lingering on screen.
#[tauri::command]
pub fn clear_history(app: AppHandle) {
    let state = app.state::<AppState>();
    state
        .inner
        .history
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .clear();
    let _ = app.emit("airtype:history", Vec::<HistoryItem>::new());
}

/// Accept or reject the phone that is currently waiting for permission.
/// Without an explicit `client_id` the pending request is used.
#[tauri::command]
pub fn resolve_pairing(
    app: AppHandle,
    approve: bool,
    client_id: Option<String>,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let inner = &state.inner;
    let target = client_id
        .map(|id| id.trim().to_string())
        .filter(|id| !id.is_empty())
        .or_else(|| {
            inner
                .pending
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .as_ref()
                .map(|p| p.id.clone())
        })
        .ok_or_else(|| "Tidak ada permintaan pairing yang menunggu".to_string())?;

    if approve {
        inner
            .approved
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(target.clone());
        inner
            .denied
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .remove(&target);
        clear_pending(inner, &app);
        broadcast_pairing_result(inner, &target, true);
        eprintln!("[airtype] pairing approved: {target}");
        activate_client(inner, &app, &target, None);
    } else {
        inner
            .denied
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(target.clone());
        clear_pending(inner, &app);
        broadcast_pairing_result(inner, &target, false);
        eprintln!("[airtype] pairing denied: {target}");
        set_presence(inner, &app, "waiting_pairing");
    }
    Ok(())
}

/// Apply an explicit pause/resume (from the mobile or the desktop UI). The
/// pause state is owned by the desktop, so both ends always agree on it.
/// Resets the auto-pause flag so a reconnect never silently un-pauses an
/// explicitly paused desktop.
fn set_paused(inner: &Arc<AppInner>, app: &AppHandle, paused: bool) {
    let prev = inner.paused.swap(paused, Ordering::SeqCst);
    if prev == paused {
        return;
    }
    inner.auto_paused.store(false, Ordering::SeqCst);
    inner.keyboard.release_all();
    *inner.last_presence.lock().unwrap_or_else(|e| e.into_inner()) =
        if paused { "paused".to_string() } else { "connected".to_string() };
    if paused {
        emit_status(app, "paused");
        broadcast_status(inner, "paused");
    } else {
        *inner.last_activity.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
        *inner.last_mobile_at.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
        emit_status(app, "connected");
        broadcast_status(inner, "connected");
    }
}

#[tauri::command]
pub fn get_ui_snapshot(state: State<'_, AppState>) -> UiSnapshot {
    let inner = &state.inner;
    let presence = inner.last_presence.lock().unwrap_or_else(|e| e.into_inner()).clone();
    UiSnapshot {
        session: session_info(inner),
        presence,
        paused: inner.paused.load(Ordering::SeqCst),
        client: inner
            .client
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .as_ref()
            .map(|link| client_info(link)),
        pending: pending_info(inner),
        stats: *inner.stats.lock().unwrap_or_else(|e| e.into_inner()),
        history: inner
            .history
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .iter()
            .cloned()
            .collect(),
        hostname: hostname(),
        auto_pause_after_ms: inner.auto_pause_ms.load(Ordering::SeqCst),
        history_enabled: inner.config.history_enabled,
    }
}

fn session_info(inner: &Arc<AppInner>) -> SessionInfo {
    let session_id = inner.session_id.lock().unwrap_or_else(|e| e.into_inner()).clone();
    SessionInfo {
        session_id: session_id.clone(),
        channel: channel_name(&session_id),
        pairing_url: inner.pairing_url.lock().unwrap_or_else(|e| e.into_inner()).clone(),
    }
}

fn hostname() -> String {
    gethostname::gethostname().to_string_lossy().into_owned()
}

fn client_info(link: &ClientLink) -> ClientInfo {
    // Epoch ms of when the link started, derived from the monotonic Instant so
    // wall-clock adjustments never move the "connected since" backwards.
    let connected_at_ms = now_ms().saturating_sub(link.connected_at.elapsed().as_millis() as u64);
    ClientInfo {
        client_id: link.id.clone(),
        connected_at_ms,
        approximate: link.approximate,
    }
}

fn emit_status(app: &AppHandle, status: &str) {
    let _ = app.emit("airtype:status", status);
}

fn emit_stats(inner: &Arc<AppInner>, app: &AppHandle) {
    let stats = *inner.stats.lock().unwrap_or_else(|e| e.into_inner());
    let _ = app.emit("airtype:stats", stats);
}

/// Record (or refresh) the linked mobile. The pairing start time is preserved
/// while the link is alive; it is only reset after a real disconnect.
fn record_client(
    inner: &Arc<AppInner>,
    app: &AppHandle,
    client_id: &str,
    approximate: bool,
    tab_id: Option<&str>,
) {
    if client_id.is_empty() {
        return;
    }
    let mut link = inner.client.lock().unwrap_or_else(|e| e.into_inner());
    match link.as_mut() {
        Some(existing) => {
            if let Some(tab) = tab_id {
                existing.tab_id = Some(tab.to_string());
            }
            if existing.id == client_id {
                return;
            }
            existing.id = client_id.to_string();
        }
        None => {
            *link = Some(ClientLink {
                id: client_id.to_string(),
                connected_at: Instant::now(),
                approximate,
                tab_id: tab_id.map(str::to_string),
            });
        }
    }
    let info = client_info(link.as_ref().expect("link set above"));
    drop(link);
    eprintln!("[airtype] client linked: {} (approx={approximate})", info.client_id);
    let _ = app.emit("airtype:client", Some(info));
}

fn clear_client(inner: &Arc<AppInner>, app: &AppHandle) {
    let had_client = inner
        .client
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take()
        .is_some();
    if had_client {
        eprintln!("[airtype] client cleared");
        let _ = app.emit("airtype:client", Option::<ClientInfo>::None);
    }
}

fn payload_client_id(value: &Value) -> &str {
    value.get("clientId").and_then(Value::as_str).unwrap_or("")
}

fn payload_tab_id(value: &Value) -> Option<&str> {
    value.get("tabId").and_then(Value::as_str)
}

fn is_approved(inner: &Arc<AppInner>, client_id: &str) -> bool {
    !client_id.is_empty()
        && inner
            .approved
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .contains(client_id)
}

fn is_denied(inner: &Arc<AppInner>, client_id: &str) -> bool {
    !client_id.is_empty()
        && inner
            .denied
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .contains(client_id)
}

fn pending_info(inner: &Arc<AppInner>) -> Option<PendingClient> {
    inner
        .pending
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .as_ref()
        .map(|p| PendingClient {
            client_id: p.id.clone(),
            requested_at_ms: now_ms()
                .saturating_sub(p.requested_at.elapsed().as_millis() as u64),
        })
}

/// Drop the pending request (if any) and tell the UI to hide the prompt.
fn clear_pending(inner: &Arc<AppInner>, app: &AppHandle) -> bool {
    let had = inner
        .pending
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take()
        .is_some();
    if had {
        let _ = app.emit("airtype:pending", Option::<PendingClient>::None);
    }
    had
}

/// Surface a phone that is waiting for the desktop user to accept it.
fn request_approval(inner: &Arc<AppInner>, app: &AppHandle, client_id: &str) {
    if client_id.is_empty() {
        return;
    }
    let newly_pending = {
        let mut pending = inner.pending.lock().unwrap_or_else(|e| e.into_inner());
        match pending.as_ref() {
            Some(p) if p.id == client_id => false,
            _ => {
                *pending = Some(PendingClientLink {
                    id: client_id.to_string(),
                    requested_at: Instant::now(),
                });
                true
            }
        }
    };
    if newly_pending {
        eprintln!("[airtype] pairing request from {client_id}");
        if let Some(info) = pending_info(inner) {
            let _ = app.emit("airtype:pending", Some(info));
        }
        broadcast_approval_required(inner, client_id);
    }
    set_presence(inner, app, "waiting_approval");
}

/// Link an approved phone: record it and confirm the live status.
fn activate_client(
    inner: &Arc<AppInner>,
    app: &AppHandle,
    client_id: &str,
    tab_id: Option<&str>,
) {
    record_client(inner, app, client_id, false, tab_id);
    *inner.last_mobile_at.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
    *inner.last_activity.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
    // A phone (re)joining means the user wants to type again: undo an idle
    // auto-pause, but respect an explicit manual pause.
    if inner.paused.load(Ordering::SeqCst) {
        if inner.auto_paused.swap(false, Ordering::SeqCst) {
            inner.paused.store(false, Ordering::SeqCst);
            inner.keyboard.release_all();
        } else {
            eprintln!("[airtype] presence: approved while manually paused -> paused");
            *inner.last_presence.lock().unwrap_or_else(|e| e.into_inner()) = "paused".to_string();
            emit_status(app, "paused");
            broadcast_status(inner, "paused");
            return;
        }
    }
    // Always confirm the fresh status to the joining mobile, even if the
    // desktop presence was already "connected" (stale join confirmation).
    *inner.last_presence.lock().unwrap_or_else(|e| e.into_inner()) = "connected".to_string();
    eprintln!("[airtype] presence: client_joined -> connected");
    emit_status(app, "connected");
    broadcast_status(inner, "connected");
}

/// Tell linked phones the session is over before rotating or quitting.
/// Without this they keep the old channel and stay in keyboard mode forever.
/// Resolves once the broadcast has left the socket (or the realtime task is
/// gone), so callers must not abort the connection before awaiting it.
pub async fn notify_session_end(app: &AppHandle) {
    let (session_id, tx) = {
        let state = app.state::<AppState>();
        let session_id = state
            .inner
            .session_id
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        let tx = state
            .inner
            .cmd_tx
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .clone();
        (session_id, tx)
    };
    let Some(tx) = tx else {
        return;
    };
    let payload = json!({
        "type": "session_ended",
        "eventId": format!("ended-{}", chrono_now()),
        "sessionId": session_id,
        "timestamp": chrono_now(),
    });
    let (ack_tx, ack_rx) = tokio::sync::oneshot::channel();
    if tx
        .send(RealtimeCommand::SendAndStop { payload, ack: ack_tx })
        .await
        .is_err()
    {
        return;
    }
    // A socket that never acknowledges must not block rotation or quit.
    let _ = tokio::time::timeout(Duration::from_secs(2), ack_rx).await;
}

/// Broadcast `desktop_status` over the session channel so mobile clients see it.
fn broadcast_status(inner: &Arc<AppInner>, status: &str) {
    let cmd_tx = inner.cmd_tx.lock().unwrap_or_else(|e| e.into_inner());
    let Some(tx) = cmd_tx.as_ref() else {
        return;
    };
    let session_id = inner.session_id.lock().unwrap_or_else(|e| e.into_inner()).clone();
    let payload = json!({
        "type": "desktop_status",
        "eventId": format!("status-{}", chrono_now()),
        "sessionId": session_id,
        "status": status,
        "deviceName": hostname(),
        // Advertises E2E support so an updated phone starts encrypting.
        // Legacy builds simply ignore the field.
        "e2e": 1,
        "timestamp": chrono_now(),
    });
    let _ = tx.try_send(RealtimeCommand::Send(payload));
}

fn broadcast_approval_required(inner: &Arc<AppInner>, client_id: &str) {
    let cmd_tx = inner.cmd_tx.lock().unwrap_or_else(|e| e.into_inner());
    let Some(tx) = cmd_tx.as_ref() else {
        return;
    };
    let session_id = inner.session_id.lock().unwrap_or_else(|e| e.into_inner()).clone();
    let payload = json!({
        "type": "approval_required",
        "eventId": format!("approval-{}", chrono_now()),
        "sessionId": session_id,
        "clientId": client_id,
        "timestamp": chrono_now(),
    });
    let _ = tx.try_send(RealtimeCommand::Send(payload));
}

fn broadcast_pairing_result(inner: &Arc<AppInner>, client_id: &str, approved: bool) {
    let cmd_tx = inner.cmd_tx.lock().unwrap_or_else(|e| e.into_inner());
    let Some(tx) = cmd_tx.as_ref() else {
        return;
    };
    let session_id = inner.session_id.lock().unwrap_or_else(|e| e.into_inner()).clone();
    let payload = json!({
        "type": "pairing_result",
        "eventId": format!("pairing-{}", chrono_now()),
        "sessionId": session_id,
        "clientId": client_id,
        "approved": approved,
        "timestamp": chrono_now(),
    });
    let _ = tx.try_send(RealtimeCommand::Send(payload));
}

/// Update pairing status locally + broadcast it, but only when it changed.
fn set_presence(inner: &Arc<AppInner>, app: &AppHandle, status: &str) {
    let mut last = inner.last_presence.lock().unwrap_or_else(|e| e.into_inner());
    if *last == status {
        return;
    }
    *last = status.to_string();
    drop(last);
    eprintln!("[airtype] presence: -> {status}");
    emit_status(app, status);
    broadcast_status(inner, status);
}

fn mouse_button(name: &str) -> Result<enigo::Button, String> {
    match name {
        "left" => Ok(enigo::Button::Left),
        "right" => Ok(enigo::Button::Right),
        "middle" => Ok(enigo::Button::Middle),
        other => Err(format!("unknown mouse button: {other}")),
    }
}

fn run_mouse(inner: &Arc<AppInner>, p: &MouseEventPayload) -> Result<(), String> {
    match p.action.as_str() {
        "move" => inner.mouse.move_relative(
            clamp_delta(p.dx.unwrap_or(0), MAX_MOUSE_DELTA),
            clamp_delta(p.dy.unwrap_or(0), MAX_MOUSE_DELTA),
        ),
        "down" => {
            let btn = mouse_button(p.button.as_deref().unwrap_or("left"))?;
            inner.mouse.button(btn, enigo::Direction::Press)
        }
        "up" => {
            let btn = mouse_button(p.button.as_deref().unwrap_or("left"))?;
            inner.mouse.button(btn, enigo::Direction::Release)
        }
        "scroll" => {
            let axis = if p.axis.as_deref() == Some("horizontal") {
                enigo::Axis::Horizontal
            } else {
                enigo::Axis::Vertical
            };
            inner
                .mouse
                .scroll(clamp_delta(p.delta.unwrap_or(0), MAX_SCROLL_DELTA), axis)
        }
        other => Err(format!("unknown mouse action: {other}")),
    }
}

fn clamp_delta(value: i32, limit: i32) -> i32 {
    value.clamp(-limit, limit)
}

fn clamp_text(text: String) -> String {
    if text.chars().count() <= MAX_TYPE_TEXT_CHARS {
        text
    } else {
        text.chars().take(MAX_TYPE_TEXT_CHARS).collect()
    }
}

fn handle_incoming(inner: &Arc<AppInner>, app: &AppHandle, value: Value) {
    // The Realtime channel finished joining: we are subscribed.
    // Do NOT force waiting_pairing here: a brief network blip makes the
    // websocket reconnect and this event fire again even though a mobile is
    // still connected â€” forcing waiting_pairing would make the phone report a
    // lost connection. Re-confirm the current presence instead.
    if value.get("type").and_then(Value::as_str) == Some("realtime_ready") {
        let last = inner.last_presence.lock().unwrap_or_else(|e| e.into_inner()).clone();
        if last.is_empty() {
            set_presence(inner, app, "waiting_pairing");
        } else {
            emit_status(app, &last);
            broadcast_status(inner, &last);
        }
        return;
    }

    let event_id = value
        .get("eventId")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    if event_id.is_empty() {
        return;
    }
    {
        let mut seen = inner.dedup.lock().unwrap_or_else(|e| e.into_inner());
        if seen.len() > 2000 {
            seen.clear();
        }
        if !seen.insert(event_id.clone()) {
            return;
        }
    }

    let payload_session = value.get("sessionId").and_then(Value::as_str).unwrap_or("");
    if payload_session != *inner.session_id.lock().unwrap_or_else(|e| e.into_inner()) {
        return;
    }

    let event_type = value.get("type").and_then(Value::as_str).unwrap_or("");

    // Presence events update pairing status and are not affected by pause.
    // Every client must be approved by the desktop user before its input is
    // simulated, so a leaked QR/link alone cannot type on this machine.
    match event_type {
        "client_joined" => {
            let client_id = payload_client_id(&value).to_string();
            if client_id.is_empty() || is_denied(inner, &client_id) {
                return;
            }
            *inner.last_mobile_at.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
            if !is_approved(inner, &client_id) {
                request_approval(inner, app, &client_id);
                return;
            }
            activate_client(inner, app, &client_id, payload_tab_id(&value));
            return;
        }
        "client_heartbeat" => {
            let client_id = payload_client_id(&value).to_string();
            if client_id.is_empty() || is_denied(inner, &client_id) {
                return;
            }
            *inner.last_mobile_at.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
            if !is_approved(inner, &client_id) {
                request_approval(inner, app, &client_id);
                return;
            }
            // Recover the link after a desktop restart: the phone only sends
            // client_joined on (re)subscribe or visibility change.
            record_client(inner, app, &client_id, true, payload_tab_id(&value));
            if inner.paused.load(Ordering::SeqCst) {
                return;
            }
            let mut last = inner.last_presence.lock().unwrap_or_else(|e| e.into_inner());
            if *last != "connected" {
                *last = "connected".to_string();
                drop(last);
                emit_status(app, "connected");
                broadcast_status(inner, "connected");
            }
            return;
        }
        "client_left" => {
            let left_id = payload_client_id(&value);
            // A pending phone that gives up must not keep the prompt visible.
            let pending_left = {
                let mut pending = inner.pending.lock().unwrap_or_else(|e| e.into_inner());
                let matches = pending
                    .as_ref()
                    .map(|p| left_id.is_empty() || p.id == left_id)
                    .unwrap_or(false);
                if matches {
                    pending.take();
                }
                matches
            };
            if pending_left {
                let _ = app.emit("airtype:pending", Option::<PendingClient>::None);
            }

            let left_tab = payload_tab_id(&value);
            let (is_current, stale_tab) = {
                let link = inner.client.lock().unwrap_or_else(|e| e.into_inner());
                match link.as_ref() {
                    Some(link) => {
                        let same_id = left_id.is_empty() || link.id == left_id;
                        let same_tab = match (left_tab, link.tab_id.as_deref()) {
                            (Some(left), Some(current)) => left == current,
                            // Legacy clients do not send a tab id.
                            _ => true,
                        };
                        (same_id && same_tab, same_id && !same_tab)
                    }
                    None => (false, false),
                }
            };
            if stale_tab {
                eprintln!("[airtype] ignoring client_left from a superseded tab");
                return;
            }
            // A stale client_left must not tear down the link of the phone
            // that is currently connected.
            if is_current {
                clear_client(inner, app);
                eprintln!("[airtype] presence: client_left -> waiting_pairing");
                set_presence(inner, app, "waiting_pairing");
            }
            return;
        }
        "desktop_status" => return,
        "client_pause" => {
            if is_approved(inner, payload_client_id(&value)) {
                let paused = value.get("paused").and_then(Value::as_bool).unwrap_or(true);
                set_paused(inner, app, paused);
            }
            return;
        }
        _ => {}
    }

    if inner.paused.load(Ordering::SeqCst) {
        return;
    }

    // Input from an unapproved phone is dropped (and surfaces the prompt).
    let input_client = payload_client_id(&value).to_string();
    if !is_approved(inner, &input_client) {
        if !input_client.is_empty() && !is_denied(inner, &input_client) {
            *inner.last_mobile_at.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
            request_approval(inner, app, &input_client);
        }
        return;
    }

    // Input events also prove the phone is linked (desktop restart case).
    record_client(inner, app, &input_client, true, payload_tab_id(&value));

    // One session cannot pump unbounded events into the OS. Dropped events
    // are counted so the UI can surface a misbehaving client.
    if !inner.rate.lock().unwrap_or_else(|e| e.into_inner()).allow() {
        let mut stats = inner.stats.lock().unwrap_or_else(|e| e.into_inner());
        stats.errors += 1;
        drop(stats);
        inner.stats_dirty.store(true, Ordering::SeqCst);
        return;
    }

    *inner.last_activity.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();

    let now = now_ms();
    let now_str = now.to_string();

    // `record` keeps routine noise (key releases, motion-only touchpad moves)
    // out of the activity feed while still simulating them.
    let (kind, code, text, action, record, result) = match event_type {
        "key_down" => match serde_json::from_value::<KeyEventPayload>(value) {
            Ok(p) => (
                "key_down".to_string(),
                Some(p.code.clone()),
                None,
                None,
                true,
                inner.keyboard.key_down(&p.code, &p.key, &p.modifiers),
            ),
            Err(e) => ("key_down".into(), None, None, None, true, Err(e.to_string())),
        },
        "key_up" => match serde_json::from_value::<KeyEventPayload>(value) {
            Ok(p) => (
                "key_up".to_string(),
                Some(p.code.clone()),
                None,
                None,
                false,
                inner.keyboard.key_up(&p.code, &p.key, &p.modifiers),
            ),
            Err(e) => ("key_up".into(), None, None, None, false, Err(e.to_string())),
        },
        "type_text" => match serde_json::from_value::<TypeTextPayload>(value) {
            Ok(p) => {
                let text = clamp_text(p.text);
                (
                    "type_text".to_string(),
                    None,
                    Some(text.clone()),
                    None,
                    true,
                    inner.keyboard.type_text(&text),
                )
            }
            Err(e) => ("type_text".into(), None, None, None, true, Err(e.to_string())),
        },
        "mouse" => match serde_json::from_value::<MouseEventPayload>(value) {
            Ok(p) => {
                let action = p.action.clone();
                let record = action != "move";
                ("mouse".to_string(), None, None, Some(action), record, run_mouse(inner, &p))
            }
            Err(e) => ("mouse".into(), None, None, None, false, Err(e.to_string())),
        },
        _ => return,
    };

    let simulated = result.is_ok();
    if let Err(e) = &result {
        eprintln!("[airtype] simulation failed: {e}");
    }

    {
        let mut stats = inner.stats.lock().unwrap_or_else(|e| e.into_inner());
        match kind.as_str() {
            "type_text" => {
                stats.chars += text
                    .as_ref()
                    .map(|t| t.chars().count() as u64)
                    .unwrap_or(0);
            }
            "key_down" => stats.key_events += 1,
            "mouse" => stats.mouse_events += 1,
            _ => {}
        }
        if !simulated {
            stats.errors += 1;
        }
        stats.last_activity_ms = Some(now);
    }
    inner.stats_dirty.store(true, Ordering::SeqCst);

    if record && inner.config.history_enabled {
        let snapshot: Vec<HistoryItem> = {
            let mut history = inner.history.lock().unwrap_or_else(|e| e.into_inner());
            history.push_front(HistoryItem {
                id: event_id.clone(),
                kind,
                code,
                text,
                action,
                received_at: now_str,
                simulated,
            });
            if history.len() > inner.config.history_limit {
                history.pop_back();
            }
            history.iter().cloned().collect()
        };
        let _ = app.emit("airtype:history", snapshot);
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn chrono_now() -> String {
    now_ms().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rate_limiter_allows_a_burst_then_throttles() {
        let mut limiter = RateLimiter::new();
        let mut allowed = 0;
        for _ in 0..(INPUT_RATE_BURST as usize + 100) {
            if limiter.allow() {
                allowed += 1;
            }
        }
        assert!(allowed <= INPUT_RATE_BURST as usize);
        assert!(allowed >= INPUT_RATE_BURST as usize - 1);
    }

    #[test]
    fn deltas_and_text_are_clamped() {
        assert_eq!(clamp_delta(5000, MAX_MOUSE_DELTA), MAX_MOUSE_DELTA);
        assert_eq!(clamp_delta(-5000, MAX_SCROLL_DELTA), -MAX_SCROLL_DELTA);
        assert_eq!(clamp_delta(7, MAX_MOUSE_DELTA), 7);

        let short = "halo".to_string();
        assert_eq!(clamp_text(short.clone()), short);
        let long = "x".repeat(MAX_TYPE_TEXT_CHARS + 10);
        assert_eq!(clamp_text(long).chars().count(), MAX_TYPE_TEXT_CHARS);
    }
}
