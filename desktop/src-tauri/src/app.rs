use std::collections::{HashSet, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::config::Config;
use crate::keyboard::KeyboardSimulator;
use crate::mouse::MouseSimulator;
use crate::realtime::{spawn_realtime, RealtimeCommand};
use crate::session::{channel_name, generate_session_id, pairing_url, realtime_topic, realtime_ws_url};
use crate::types::{HistoryItem, KeyEventPayload, MouseEventPayload, SessionInfo, TypeTextPayload};

/// If the mobile goes silent for this long, fall back to waiting_pairing.
const MOBILE_PRESENCE_TIMEOUT_SECS: u64 = 60;

pub struct AppState {
    pub inner: Arc<AppInner>,
}

pub struct AppInner {
    pub config: Config,
    pub session_id: Mutex<String>,
    pub paused: AtomicBool,
    /// True when `paused` came from auto-pause (idle), not a manual toggle.
    pub auto_paused: AtomicBool,
    pub keyboard: KeyboardSimulator,
    pub mouse: MouseSimulator,
    pub history: Mutex<VecDeque<HistoryItem>>,
    pub dedup: Mutex<HashSet<String>>,
    pub cmd_tx: Mutex<Option<tokio::sync::mpsc::Sender<RealtimeCommand>>>,
    pub out_rx: Mutex<Option<tokio::sync::mpsc::Receiver<Value>>>,
    pub realtime_abort: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    pub loop_abort: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    pub pairing_url: Mutex<String>,
    pub last_activity: Mutex<Instant>,
    pub last_mobile_at: Mutex<Instant>,
    pub last_presence: Mutex<String>,
    pub init_started: AtomicBool,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        AppState {
            inner: Arc::new(AppInner {
                config,
                session_id: Mutex::new(generate_session_id()),
                paused: AtomicBool::new(false),
                auto_paused: AtomicBool::new(false),
                keyboard: KeyboardSimulator::new(),
                mouse: MouseSimulator::new(),
                history: Mutex::new(VecDeque::with_capacity(100)),
                dedup: Mutex::new(HashSet::new()),
                cmd_tx: Mutex::new(None),
                out_rx: Mutex::new(None),
                realtime_abort: Mutex::new(None),
                loop_abort: Mutex::new(None),
                pairing_url: Mutex::new(String::new()),
                last_activity: Mutex::new(Instant::now()),
                last_mobile_at: Mutex::new(Instant::now()),
                last_presence: Mutex::new(String::new()),
                init_started: AtomicBool::new(false),
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

            // Presence watchdog: if the mobile has been silent for too long,
            // fall back to waiting_pairing (handles mobile dying without client_left).
            if !inner.paused.load(Ordering::SeqCst) {
                let mobile_idle = inner.last_mobile_at.lock().unwrap_or_else(|e| e.into_inner()).elapsed().as_secs();
                if mobile_idle > MOBILE_PRESENCE_TIMEOUT_SECS {
                    set_presence(&inner, &app2, "waiting_pairing");
                }
            }

            let timeout = inner.config.auto_pause_after_ms;
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
pub fn new_session(app: AppHandle) -> Result<SessionInfo, String> {
    let state = app.state::<AppState>();
    // Stop old realtime connection cleanly.
    if let Some(tx) = state.inner.cmd_tx.lock().unwrap_or_else(|e| e.into_inner()).take() {
        let _ = tx.try_send(RealtimeCommand::Stop);
    }
    *state.inner.session_id.lock().unwrap_or_else(|e| e.into_inner()) = generate_session_id();
    state.inner.dedup.lock().unwrap_or_else(|e| e.into_inner()).clear();
    state.restart_realtime(&app)?;
    Ok(get_session_info(app.state::<AppState>()))
}

#[tauri::command]
pub fn toggle_pause(app: AppHandle) -> bool {
    let state = app.state::<AppState>();
    let was_paused = state.inner.paused.swap(true, Ordering::SeqCst);
    if was_paused {
        // resume
        state.inner.paused.store(false, Ordering::SeqCst);
        state.inner.auto_paused.store(false, Ordering::SeqCst);
        state.inner.keyboard.release_all();
        *state.inner.last_activity.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
        *state.inner.last_mobile_at.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
        *state.inner.last_presence.lock().unwrap_or_else(|e| e.into_inner()) = "connected".to_string();
        emit_status(&app, "connected");
        broadcast_status(&state.inner, "connected");
        return false;
    }
    state.inner.keyboard.release_all();
    state.inner.auto_paused.store(false, Ordering::SeqCst);
    *state.inner.last_presence.lock().unwrap_or_else(|e| e.into_inner()) = "paused".to_string();
    emit_status(&app, "paused");
    broadcast_status(&state.inner, "paused");
    true
}

#[tauri::command]
pub fn get_session_info(state: State<'_, AppState>) -> SessionInfo {
    let session_id = state.inner.session_id.lock().unwrap_or_else(|e| e.into_inner()).clone();
    SessionInfo {
        session_id: session_id.clone(),
        channel: channel_name(&session_id),
        pairing_url: state.inner.pairing_url.lock().unwrap_or_else(|e| e.into_inner()).clone(),
    }
}

#[tauri::command]
pub fn get_history(state: State<'_, AppState>) -> Vec<HistoryItem> {
    state.inner.history.lock().unwrap_or_else(|e| e.into_inner()).iter().cloned().collect()
}

fn emit_status(app: &AppHandle, status: &str) {
    let _ = app.emit("airtype:status", status);
}

/// Broadcast `desktop_status` over the session channel so mobile clients see it.
fn broadcast_status(inner: &Arc<AppInner>, status: &str) {
    let cmd_tx = inner.cmd_tx.lock().unwrap_or_else(|e| e.into_inner());
    let Some(tx) = cmd_tx.as_ref() else {
        return;
    };
    let session_id = inner.session_id.lock().unwrap_or_else(|e| e.into_inner()).clone();
    let device_name = gethostname::gethostname().to_string_lossy().into_owned();
    let payload = json!({
        "type": "desktop_status",
        "eventId": format!("status-{}", chrono_now()),
        "sessionId": session_id,
        "status": status,
        "deviceName": device_name,
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
        "move" => inner.mouse.move_relative(p.dx.unwrap_or(0), p.dy.unwrap_or(0)),
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
            inner.mouse.scroll(p.delta.unwrap_or(0), axis)
        }
        other => Err(format!("unknown mouse action: {other}")),
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
    match event_type {
        "client_joined" => {
            *inner.last_mobile_at.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
            *inner.last_activity.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
            // A mobile reconnecting means the user wants to type again: undo an
            // idle auto-pause, but respect an explicit manual pause.
            if inner.paused.load(Ordering::SeqCst) {
                if inner.auto_paused.swap(false, Ordering::SeqCst) {
                    inner.paused.store(false, Ordering::SeqCst);
                    inner.keyboard.release_all();
                } else {
                    eprintln!("[airtype] presence: client_joined while manually paused -> paused");
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
            return;
        }
        "client_heartbeat" => {
            *inner.last_mobile_at.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();
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
            eprintln!("[airtype] presence: client_left -> waiting_pairing");
            set_presence(inner, app, "waiting_pairing");
            return;
        }
        "desktop_status" => return,
        _ => {}
    }

    if inner.paused.load(Ordering::SeqCst) {
        return;
    }

    *inner.last_activity.lock().unwrap_or_else(|e| e.into_inner()) = Instant::now();

    let now = chrono_now();

    let (kind, code, text, result) = match event_type {
        "key_down" => match serde_json::from_value::<KeyEventPayload>(value) {
            Ok(p) => (
                "key_down".to_string(),
                Some(p.code.clone()),
                None,
                inner.keyboard.key_down(&p.code, &p.key, &p.modifiers),
            ),
            Err(e) => ("key_down".into(), None, None, Err(e.to_string())),
        },
        "key_up" => match serde_json::from_value::<KeyEventPayload>(value) {
            Ok(p) => (
                "key_up".to_string(),
                Some(p.code.clone()),
                None,
                inner.keyboard.key_up(&p.code, &p.key, &p.modifiers),
            ),
            Err(e) => ("key_up".into(), None, None, Err(e.to_string())),
        },
        "type_text" => match serde_json::from_value::<TypeTextPayload>(value) {
            Ok(p) => (
                "type_text".to_string(),
                None,
                Some(p.text.clone()),
                inner.keyboard.type_text(&p.text),
            ),
            Err(e) => ("type_text".into(), None, None, Err(e.to_string())),
        },
        "mouse" => match serde_json::from_value::<MouseEventPayload>(value) {
            Ok(p) => ("mouse".to_string(), None, None, run_mouse(inner, &p)),
            Err(e) => ("mouse".into(), None, None, Err(e.to_string())),
        },
        _ => return,
    };

    if let Err(e) = &result {
        eprintln!("[airtype] simulation failed: {e}");
    }

    if inner.config.history_enabled {
        let item = HistoryItem {
            id: event_id.clone(),
            kind,
            code,
            text,
            received_at: now,
            simulated: result.is_ok(),
        };
        let mut history = inner.history.lock().unwrap_or_else(|e| e.into_inner());
        history.push_front(item);
        if history.len() > inner.config.history_limit {
            history.pop_back();
        }
        let snapshot: Vec<HistoryItem> = history.iter().cloned().collect();
        let _ = app.emit("airtype:history", snapshot);
    }
}

fn chrono_now() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .to_string()
}
