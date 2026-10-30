use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Modifiers {
    pub shift: bool,
    pub ctrl: bool,
    pub alt: bool,
    pub meta: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)] // fields are populated by serde; read individually by callers
pub struct KeyEventPayload {
    pub r#type: String,
    pub session_id: String,
    pub event_id: String,
    pub client_id: String,
    pub code: String,
    pub key: String,
    pub modifiers: Modifiers,
    pub timestamp: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)] // fields are populated by serde; read individually by callers
pub struct TypeTextPayload {
    pub r#type: String,
    pub session_id: String,
    pub event_id: String,
    pub client_id: String,
    pub text: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)] // fields are populated by serde; read individually by callers
pub struct MouseEventPayload {
    pub r#type: String,
    pub session_id: String,
    pub event_id: String,
    pub client_id: String,
    pub action: String,
    pub button: Option<String>,
    pub dx: Option<i32>,
    pub dy: Option<i32>,
    pub delta: Option<i32>,
    pub axis: Option<String>,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: String,
    pub kind: String,
    pub code: Option<String>,
    pub text: Option<String>,
    /// Mouse action ("down", "up", "scroll"); `None` for key/text events.
    pub action: Option<String>,
    pub received_at: String,
    pub simulated: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub session_id: String,
    pub channel: String,
    pub pairing_url: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientInfo {
    pub client_id: String,
    pub connected_at_ms: u64,
    /// The link was inferred from an input event after a desktop restart, so
    /// `connected_at_ms` is the backfill time, not the real pairing time.
    pub approximate: bool,
}

#[derive(Debug, Clone, Copy, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub chars: u64,
    pub key_events: u64,
    pub mouse_events: u64,
    pub errors: u64,
    pub last_activity_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UiSnapshot {
    pub session: SessionInfo,
    pub presence: String,
    pub paused: bool,
    pub client: Option<ClientInfo>,
    pub stats: Stats,
    pub history: Vec<HistoryItem>,
    pub hostname: String,
    pub auto_pause_after_ms: u64,
    pub history_enabled: bool,
}
