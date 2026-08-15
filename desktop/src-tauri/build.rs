use std::env;
use std::fs;
use std::path::Path;

/// Bake Supabase credentials into the binary at compile time so the installed
/// app works without a local `.env`. Values come from `../.env` and can be
/// overridden by shell env vars. The anon key is public by design (it is also
/// shipped in the mobile PWA), so embedding it is not a secret.
fn main() {
    println!("cargo:rustc-check-cfg=cfg(mobile)");
    println!("cargo:rerun-if-changed=../.env");
    println!("cargo:rerun-if-env-changed=AIRTYPE_SUPABASE_URL");
    println!("cargo:rerun-if-env-changed=AIRTYPE_SUPABASE_ANON_KEY");
    println!("cargo:rerun-if-env-changed=AIRTYPE_PAIRING_BASE_URL");

    let mut url = String::new();
    let mut key = String::new();
    let mut pairing_base_url = String::new();

    if let Ok(content) = fs::read_to_string(Path::new("../.env")) {
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some((k, v)) = line.split_once('=') {
                let value = v.trim().trim_matches('"').trim_matches('\'');
                match k.trim() {
                    "AIRTYPE_SUPABASE_URL" => url = value.to_string(),
                    "AIRTYPE_SUPABASE_ANON_KEY" => key = value.to_string(),
                    "AIRTYPE_PAIRING_BASE_URL" => pairing_base_url = value.to_string(),
                    _ => {}
                }
            }
        }
    }

    if let Ok(v) = env::var("AIRTYPE_SUPABASE_URL") {
        url = v;
    }
    if let Ok(v) = env::var("AIRTYPE_SUPABASE_ANON_KEY") {
        key = v;
    }
    if let Ok(v) = env::var("AIRTYPE_PAIRING_BASE_URL") {
        pairing_base_url = v;
    }

    let out_dir = env::var("OUT_DIR").expect("OUT_DIR is not set");
    let out_file = Path::new(&out_dir).join("generated_config.rs");
    let content = format!(
        "pub const BAKED_SUPABASE_URL: &str = {:?};\npub const BAKED_SUPABASE_ANON_KEY: &str = {:?};\npub const BAKED_PAIRING_BASE_URL: &str = {:?};\n",
        url, key, pairing_base_url
    );
    fs::write(out_file, content).expect("failed to write generated_config.rs");

    // Generates the Windows resources + application manifest (Common Controls v6)
    // required for the app to launch. Must run, otherwise the binary is built
    // without a manifest and fails with "TaskDialogIndirect entry point not found".
    tauri_build::build();
}
