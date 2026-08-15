use std::collections::{HashSet, VecDeque};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::config::Config;
use crate::keyboard::KeyboardSimulator;
use crate::realtime::{spawn_realtime, RealtimeCommand};
use crate::session::{channel_name, generate_session_id, pairing_url, realtime_ws_url};
use crate::types::{HistoryItem, KeyEventPayload, SessionInfo, TypeTextPayload};

pub struct AppState {
    pub inner: Arc<AppInner>,
}

pub struct AppInner {
    pub config: Config,
    pub session_id: Mutex<String>,
    pub paused: AtomicBool,
    pub keyboard: KeyboardSimulator,
    pub history: Mutex<VecDeque<HistoryItem>>,
    pub dedup: Mutex<HashSet<String>>,
    pub cmd_tx: Mutex<Option<tokio::sync::mpsc::Sender<RealtimeCommand>>>,
    pub out_rx: Mutex<Option<tokio::sync::mpsc::Receiver<Value>>>,
    pub loop_abort: Mutex<Option<tauri::async_runtime::JoinHandle<()>>>,
    pub pairing_url: Mutex<String>,
    pub last_activity: Mutex<Instant>,
    pub init_started: AtomicBool,
}

impl AppState {
    pub fn new(config: Config) -> Self {
        AppState {
            inner: Arc::new(AppInner {
                config,
                session_id: Mutex::new(generate_session_id()),
                paused: AtomicBool::new(false),
                keyboard: KeyboardSimulator::new(),
                history: Mutex::new(VecDeque::with_capacity(100)),
                dedup: Mutex::new(HashSet::new()),
                cmd_tx: Mutex::new(None),
                out_rx: Mutex::new(None),
                loop_abort: Mutex::new(None),
                pairing_url: Mutex::new(String::new()),
                last_activity: Mutex::new(Instant::now()),
                init_started: AtomicBool::new(false),
            }),
        }
    }

    fn restart_realtime(&self, app: &AppHandle) -> Result<(), String> {
        let session_id = self.inner.session_id.lock().unwrap().clone();
        let channel = channel_name(&session_id);
        *self.inner.pairing_url.lock().unwrap() =
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
        *self.inner.cmd_tx.lock().unwrap() = Some(cmd_tx);
        *self.inner.out_rx.lock().unwrap() = Some(out_rx);

        spawn_realtime(
            ws_url,
            channel,
            self.inner.config.supabase_anon_key.clone(),
            out_tx,
            cmd_rx,
        );

        self.start_message_loop(app);
        emit_status(app, "subscribing");
        Ok(())
    }

    fn start_message_loop(&self, app: &AppHandle) {
        if let Some(prev) = self.inner.loop_abort.lock().unwrap().take() {
            prev.abort();
        }
        let rx = match self.inner.out_rx.lock().unwrap().take() {
            Some(rx) => rx,
            None => return,
        };
        let inner = self.inner.clone();
        let app2 = app.clone();
        let handle = tauri::async_runtime::spawn(async move {
            let mut rx = rx;
            while let Some(value) = rx.recv().await {
                handle_incoming(&inner, &app2, value);
            }
        });
        *self.inner.loop_abort.lock().unwrap() = Some(handle);
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
            let timeout = inner.config.auto_pause_after_ms;
            if timeout == 0 {
                continue;
            }
            let idle = inner.last_activity.lock().unwrap().elapsed().as_millis() as u64;
            if idle > timeout && !inner.paused.load(Ordering::SeqCst) {
                inner.paused.store(true, Ordering::SeqCst);
                inner.keyboard.release_all();
                let _ = app2.emit("airtype:status", "paused");
            }
        }
    });
    Ok(())
}

#[tauri::command]
pub fn new_session(app: AppHandle) -> Result<SessionInfo, String> {
    let state = app.state::<AppState>();
    // Stop old realtime connection cleanly.
    if let Some(tx) = state.inner.cmd_tx.lock().unwrap().take() {
        let _ = tx.try_send(RealtimeCommand::Stop);
    }
    *state.inner.session_id.lock().unwrap() = generate_session_id();
    state.inner.dedup.lock().unwrap().clear();
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
        state.inner.keyboard.release_all();
        *state.inner.last_activity.lock().unwrap() = Instant::now();
        emit_status(&app, "connected");
        broadcast_status(&state.inner, "connected");
        return false;
    }
    state.inner.keyboard.release_all();
    emit_status(&app, "paused");
    broadcast_status(&state.inner, "paused");
    true
}

#[tauri::command]
pub fn get_session_info(state: State<'_, AppState>) -> SessionInfo {
    let session_id = state.inner.session_id.lock().unwrap().clone();
    SessionInfo {
        session_id: session_id.clone(),
        channel: channel_name(&session_id),
        pairing_url: state.inner.pairing_url.lock().unwrap().clone(),
    }
}

#[tauri::command]
pub fn get_history(state: State<'_, AppState>) -> Vec<HistoryItem> {
    state.inner.history.lock().unwrap().iter().cloned().collect()
}

fn emit_status(app: &AppHandle, status: &str) {
    let _ = app.emit("airtype:status", status);
}

/// Broadcast `desktop_status` over the session channel so mobile clients see it.
fn broadcast_status(inner: &Arc<AppInner>, status: &str) {
    let cmd_tx = inner.cmd_tx.lock().unwrap();
    let Some(tx) = cmd_tx.as_ref() else {
        return;
    };
    let session_id = inner.session_id.lock().unwrap().clone();
    let payload = json!({
        "type": "desktop_status",
        "eventId": format!("status-{}", chrono_now()),
        "sessionId": session_id,
        "status": status,
        "timestamp": chrono_now(),
    });
    let _ = tx.try_send(RealtimeCommand::Send(payload));
}

fn handle_incoming(inner: &Arc<AppInner>, app: &AppHandle, value: Value) {
    let event_id = value
        .get("eventId")
        .and_then(Value::as_str)
        .unwrap_or("")
        .to_string();
    if event_id.is_empty() {
        return;
    }
    {
        let mut seen = inner.dedup.lock().unwrap();
        if seen.len() > 2000 {
            seen.clear();
        }
        if !seen.insert(event_id.clone()) {
            return;
        }
    }

    let payload_session = value.get("sessionId").and_then(Value::as_str).unwrap_or("");
    if payload_session != *inner.session_id.lock().unwrap() {
        return;
    }

    let event_type = value.get("type").and_then(Value::as_str).unwrap_or("");

    // Presence events update pairing status and are not affected by pause.
    match event_type {
        "client_joined" => {
            emit_status(app, "connected");
            broadcast_status(inner, "connected");
            return;
        }
        "client_left" => {
            emit_status(app, "waiting_pairing");
            broadcast_status(inner, "waiting_pairing");
            return;
        }
        "desktop_status" => return,
        _ => {}
    }

    if inner.paused.load(Ordering::SeqCst) {
        return;
    }

    *inner.last_activity.lock().unwrap() = Instant::now();

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
        let mut history = inner.history.lock().unwrap();
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
