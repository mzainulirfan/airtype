include!(concat!(env!("OUT_DIR"), "/generated_config.rs"));

pub struct Config {
    pub supabase_url: String,
    pub supabase_anon_key: String,
    pub pairing_base_url: String,
    pub auto_pause_after_ms: u64,
    pub history_enabled: bool,
    pub history_limit: usize,
}

impl Config {
    pub fn load() -> Self {
        load_dotenv();
        Config {
            supabase_url: env_first_baked(
                &["AIRTYPE_SUPABASE_URL", "SUPABASE_URL"],
                BAKED_SUPABASE_URL,
            ),
            supabase_anon_key: env_first_baked(
                &["AIRTYPE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY"],
                BAKED_SUPABASE_ANON_KEY,
            ),
            pairing_base_url: env_or("AIRTYPE_PAIRING_BASE_URL", "https://airtype.app"),
            auto_pause_after_ms: env_u64("AIRTYPE_AUTO_PAUSE_AFTER_MS", 60_000),
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

/// Load `KEY=VALUE` lines from a local `.env` file into the process
/// environment, without overriding variables that are already set.
fn load_dotenv() {
    let mut candidate = std::env::current_dir().unwrap_or_default();
    candidate.push(".env");
    if !candidate.is_file() {
        candidate.pop();
        candidate.push("..");
        candidate.push(".env");
        if !candidate.is_file() {
            return;
        }
    }

    let Ok(content) = std::fs::read_to_string(&candidate) else {
        return;
    };
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let mut parts = line.splitn(2, '=');
        let (Some(key), Some(value)) = (parts.next(), parts.next()) else {
            continue;
        };
        let key = key.trim();
        let value = value.trim().trim_matches('"').trim_matches('\'');
        if !key.is_empty() && std::env::var(key).is_err() {
            std::env::set_var(key, value);
        }
    }
}

fn env_first_baked(keys: &[&str], baked: &str) -> String {
    for key in keys {
        if let Ok(value) = std::env::var(key) {
            if !value.is_empty() {
                return value;
            }
        }
    }
    baked.to_string()
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
