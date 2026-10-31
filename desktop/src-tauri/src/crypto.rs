use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};

// The session id doubles as the pairing secret, so both ends can derive the
// same key without another exchange. The prefix keeps the derivation scoped.
const KEY_PREFIX: &str = "airtype-e2e-v1:";

pub type Key = [u8; 32];

pub fn derive_key(session_id: &str) -> Key {
    let digest = Sha256::digest(format!("{KEY_PREFIX}{session_id}").as_bytes());
    let mut key = [0u8; 32];
    key.copy_from_slice(&digest);
    key
}

pub fn is_envelope(value: &Value) -> bool {
    value.get("v").and_then(Value::as_u64) == Some(1)
        && value.get("enc").and_then(Value::as_str).is_some()
}

/// Encrypt a broadcast payload into the wire envelope
/// `{ v: 1, enc: base64(nonce || ciphertext+tag) }`.
pub fn encrypt_value(key: &Key, value: &Value) -> Option<Value> {
    let cipher = Aes256Gcm::new_from_slice(key).ok()?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let plaintext = serde_json::to_vec(value).ok()?;
    let ciphertext = cipher.encrypt(&nonce, plaintext.as_slice()).ok()?;
    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(nonce.as_slice());
    combined.extend_from_slice(&ciphertext);
    Some(json!({ "v": 1, "enc": STANDARD.encode(combined) }))
}

/// Decrypt a wire envelope back into the original payload. Returns `None` for
/// malformed, tampered, or wrong-key envelopes; callers drop those.
pub fn decrypt_value(key: &Key, value: &Value) -> Option<Value> {
    if !is_envelope(value) {
        return None;
    }
    let encoded = value.get("enc").and_then(Value::as_str)?;
    let raw = STANDARD.decode(encoded).ok()?;
    if raw.len() < 12 + 16 {
        return None;
    }
    let cipher = Aes256Gcm::new_from_slice(key).ok()?;
    let nonce = Nonce::from_slice(&raw[..12]);
    let plaintext = cipher.decrypt(nonce, &raw[12..]).ok()?;
    serde_json::from_slice(&plaintext).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    const SESSION: &str = "0123456789abcdef0123456789abcdef";
    // Generated with Node's WebCrypto/crypto AES-256-GCM implementation using
    // SHA-256("airtype-e2e-v1:" + SESSION) and a fixed nonce 00..0b, so this
    // pins interoperability with the browser client.
    const WEBCRYPTO_ENVELOPE: &str = "AAECAwQFBgcICQoLlDppoC5JrVp4RuPMJWJh64r039pcVkFcwGkiTDa8nC7fTesbm14u5/myEIGzvjMGFEx+Gp4Fdt8zQqFaZBO04AIr4p1hgRNKmS5LhFeOm+xjmR2saNqymhuZrEtw8bJACiJuZXfU+oy3hTt7aT9H5opDsVTisbXqzdQnDhs3owtn7/TmVQyrU2+wD6gBX2jqYalJ8sWlvrwXRgB98id0xNmUE74qMPBo";

    #[test]
    fn key_derivation_matches_browser() {
        assert_eq!(STANDARD.encode(derive_key(SESSION)), "zvmauCGHxrn8xSRH7fAoBfr5TFH9E6vw8YRSN3mAiPs=");
    }

    #[test]
    fn decrypts_webcrypto_envelope() {
        let env = json!({ "v": 1, "enc": WEBCRYPTO_ENVELOPE });
        let plain = decrypt_value(&derive_key(SESSION), &env).expect("decrypt");
        assert_eq!(plain["type"], "client_heartbeat");
        assert_eq!(plain["clientId"], "mobile-test");
    }

    #[test]
    fn roundtrip() {
        let key = derive_key(SESSION);
        let value = json!({ "type": "key_down", "code": "KeyA" });
        let envelope = encrypt_value(&key, &value).expect("encrypt");
        assert_eq!(decrypt_value(&key, &envelope).expect("decrypt"), value);
    }

    #[test]
    fn wrong_key_and_tampering_are_rejected() {
        let key = derive_key(SESSION);
        let envelope = encrypt_value(&key, &json!({ "type": "key_down" })).expect("encrypt");
        assert!(decrypt_value(&derive_key("other-session"), &envelope).is_none());

        let encoded = envelope["enc"].as_str().unwrap();
        let mut raw = STANDARD.decode(encoded).unwrap();
        raw[12] ^= 0xff;
        let tampered = json!({ "v": 1, "enc": STANDARD.encode(raw) });
        assert!(decrypt_value(&key, &tampered).is_none());
    }
}
