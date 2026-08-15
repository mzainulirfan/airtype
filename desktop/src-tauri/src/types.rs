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

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryItem {
    pub id: String,
    pub kind: String,
    pub code: Option<String>,
    pub text: Option<String>,
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
