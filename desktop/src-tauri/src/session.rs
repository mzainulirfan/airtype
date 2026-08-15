use uuid::Uuid;

pub fn generate_session_id() -> String {
    Uuid::new_v4().simple().to_string()[..6].to_string()
}

pub fn channel_name(session_id: &str) -> String {
    format!("airtype:session:{session_id}")
}

/// Full Realtime topic for a channel. The Supabase Realtime service expects
/// topics to be prefixed with `realtime:` (supabase-js does this automatically).
pub fn realtime_topic(channel: &str) -> String {
    format!("realtime:{channel}")
}

/// Build the Supabase Realtime WebSocket URL from a project URL + anon key.
pub fn realtime_ws_url(supabase_url: &str, anon_key: &str) -> String {
    let base = supabase_url.trim_end_matches('/');
    let https = format!("{base}/realtime/v1/websocket");
    let wss = https.replacen("https://", "wss://", 1).replacen("http://", "ws://", 1);
    format!("{wss}?apikey={anon_key}&vsn=1.0.0")
}

pub fn pairing_url(base_url: &str, session_id: &str) -> String {
    let base = base_url.trim_end_matches('/');
    format!("{base}/connect?session={session_id}")
}
