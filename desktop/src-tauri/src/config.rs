pub struct Config {
    pub supabase_url: String,
    pub supabase_anon_key: String,
    pub pairing_base_url: String,
    pub key_event_mode: String,
    pub auto_pause_after_ms: u64,
    pub ack_enabled: bool,
    pub history_enabled: bool,
    pub history_limit: usize,
}

impl Config {
    pub fn load() -> Self {
        Config {
            supabase_url: env_var_fallback("AIRTYPE_SUPABASE_URL", "SUPABASE_URL"),
            supabase_anon_key: env_var_fallback("AIRTYPE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"),
            key_event_mode: env_or("AIRTYPE_KEY_EVENT_MODE", "auto"),
            pairing_base_url: env_or("AIRTYPE_PAIRING_BASE_URL", "https://airtype.app"),
            auto_pause_after_ms: env_u64("AIRTYPE_AUTO_PAUSE_AFTER_MS", 60_000),
            ack_enabled: env_bool("AIRTYPE_ACK_ENABLED", false),
            history_enabled: env_bool("AIRTYPE_HISTORY_ENABLED", true),
            history_limit: env_usize("AIRTYPE_HISTORY_LIMIT", 100),
        }
    }

    pub fn is_configured(&self) -> bool {
        !self.supabase_url.is_empty() && !self.supabase_anon_key.is_empty()
    }
}

fn env_or(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

fn env_var_fallback(primary: &str, fallback: &str) -> String {
    std::env::var(primary)
        .or_else(|_| std::env::var(fallback))
        .unwrap_or_default()
}

fn env_u64(key: &str, default: u64) -> u64 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_usize(key: &str, default: usize) -> usize {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

fn env_bool(key: &str, default: bool) -> bool {
    std::env::var(key)
        .ok()
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(default)
}
