use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;

use crate::crypto::{self, Key};

pub enum RealtimeCommand {
    Send(Value),
    /// Send a final broadcast, give the server a moment to fan it out, close
    /// the socket and then acknowledge. Callers await the ack instead of
    /// racing an abort, which could kill the task before the message left.
    SendAndStop {
        payload: Value,
        ack: tokio::sync::oneshot::Sender<()>,
    },
}

/// Spawn a background task that keeps a Supabase Realtime connection alive,
/// forwards incoming broadcasts through `out_tx` and applies commands.
/// Returns a handle that can be aborted to stop the task (and close the socket).
pub fn spawn_realtime(
    ws_url: String,
    channel: String,
    session_id: String,
    access_token: String,
    out_tx: mpsc::Sender<Value>,
    cmd_rx: mpsc::Receiver<RealtimeCommand>,
) -> tauri::async_runtime::JoinHandle<()> {
    tauri::async_runtime::spawn(async move {
        let mut cmd_rx = cmd_rx;
        let mut retry = 1u64;
        let key = crypto::derive_key(&session_id);
        // Flipped once a peer proves it speaks the encrypted envelope. The
        // flag is per connection: a fresh socket starts in plaintext so an
        // older phone build can still talk to us.
        let mut peer_encrypted = false;
        loop {
            let clean = run_connection(
                &ws_url,
                &channel,
                &access_token,
                &key,
                &mut peer_encrypted,
                out_tx.clone(),
                &mut cmd_rx,
            )
            .await;
            if clean {
                eprintln!("[realtime] connection ended cleanly");
                break;
            }
            let delay = (retry * 2).min(30);
            retry += 1;
            // While backing off there is no socket to talk to, but the caller
            // of SendAndStop still wants its ack: answer it immediately so a
            // session rotation is not stalled waiting on a dead connection.
            let deadline = tokio::time::Instant::now() + Duration::from_secs(delay);
            loop {
                tokio::select! {
                    _ = tokio::time::sleep_until(deadline) => break,
                    cmd = cmd_rx.recv() => match cmd {
                        Some(RealtimeCommand::SendAndStop { ack, .. }) => {
                            let _ = ack.send(());
                            return;
                        }
                        Some(RealtimeCommand::Send(_)) => {}
                        None => return,
                    },
                }
            }
        }
    })
}

/// Returns true if the connection ended cleanly (no retry needed).
async fn run_connection(
    ws_url: &str,
    channel: &str,
    access_token: &str,
    key: &Key,
    peer_encrypted: &mut bool,
    out_tx: mpsc::Sender<Value>,
    cmd_rx: &mut mpsc::Receiver<RealtimeCommand>,
) -> bool {
    *peer_encrypted = false;
    let request = match ws_url.to_string().into_client_request() {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[realtime] invalid ws url: {e}");
            return false;
        }
    };

    let (ws, _) = match tokio_tungstenite::connect_async(request).await {
        Ok(v) => v,
        Err(e) => {
            eprintln!("[realtime] connect failed: {e}");
            return false;
        }
    };

    eprintln!("[realtime] connected, joining channel {channel}");
    let (mut sink, mut stream) = ws.split();

    let join = json!({
        "topic": channel,
        "event": "phx_join",
        "payload": {
            "config": {
                "broadcast": { "self": false },
                "presence": { "key": "" },
                "private": false,
                "postgres_changes": []
            },
            "access_token": access_token
        },
        "ref": "1"
    });

    if sink.send(Message::Text(join.to_string().into())).await.is_err() {
        return false;
    }

    // Half-open connections (NAT/proxy silently dropping the TCP link) never
    // deliver a close frame, so the read loop below would hang forever while
    // both apps still think they are connected. Track the last time anything
    // arrived (server heartbeats, mobile broadcasts) and reconnect if it goes
    // stale, even without an explicit close.
    let stale_after = Duration::from_secs(45);
    let mut last_seen = std::time::Instant::now();
    let mut ticker = tokio::time::interval(Duration::from_secs(10));
    ticker.tick().await; // consume the first immediate tick

    loop {
        tokio::select! {
            incoming = stream.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        last_seen = std::time::Instant::now();
                        let parsed: Value = match serde_json::from_str(&text) {
                            Ok(v) => v,
                            Err(_) => continue,
                        };
                        match handle_message(parsed, channel, key, peer_encrypted, out_tx.clone()).await {
                            Some(reply) => {
                                if sink.send(Message::Text(reply.to_string().into())).await.is_err() {
                                    return false;
                                }
                            }
                            None => {}
                        }
                    }
                    Some(Ok(_)) => {
                        last_seen = std::time::Instant::now();
                    }
                    Some(Err(e)) => {
                        eprintln!("[realtime] read error: {e}");
                        return false;
                    }
                    None => {
                        eprintln!("[realtime] connection closed");
                        return false;
                    }
                }
            }
            cmd = cmd_rx.recv() => {
                match cmd {
                    Some(RealtimeCommand::Send(payload)) => {
                        let Some(wire) = wire_payload(key, *peer_encrypted, &payload) else {
                            eprintln!("[realtime] failed to encrypt outbound payload");
                            continue;
                        };
                        let msg = json!({
                            "topic": channel,
                            "event": "broadcast",
                            "payload": {
                                "type": "broadcast",
                                "event": "airtype",
                                "payload": wire
                            },
                            "ref": null
                        });
                        if sink.send(Message::Text(msg.to_string().into())).await.is_err() {
                            return false;
                        }
                    }
                    Some(RealtimeCommand::SendAndStop { payload, ack }) => {
                        let Some(wire) = wire_payload(key, *peer_encrypted, &payload) else {
                            let _ = ack.send(());
                            return true;
                        };
                        let msg = json!({
                            "topic": channel,
                            "event": "broadcast",
                            "payload": {
                                "type": "broadcast",
                                "event": "airtype",
                                "payload": wire
                            },
                            "ref": null
                        });
                        let sent = sink
                            .send(Message::Text(msg.to_string().into()))
                            .await
                            .is_ok();
                        if sent {
                            // Supabase fans broadcasts out asynchronously; a
                            // close immediately after the send can win the race
                            // and drop the message. Give it a moment to land.
                            tokio::time::sleep(Duration::from_millis(250)).await;
                        }
                        let _ = sink.send(Message::Close(None)).await;
                        let _ = ack.send(());
                        return true;
                    }
                    None => return true,
                }
            }
            _ = ticker.tick() => {
                if last_seen.elapsed() > stale_after {
                    eprintln!("[realtime] no traffic for {stale_after:?}, reconnecting");
                    return false;
                }
            }
        }
    }
}

/// Encrypt outbound payloads once the peer proved it can decrypt them.
fn wire_payload(key: &Key, encrypt: bool, payload: &Value) -> Option<Value> {
    if encrypt {
        crypto::encrypt_value(key, payload)
    } else {
        Some(payload.clone())
    }
}

/// Process one inbound JSON message. Returns an optional reply to send back.
async fn handle_message(
    parsed: Value,
    channel: &str,
    key: &Key,
    peer_encrypted: &mut bool,
    out_tx: mpsc::Sender<Value>,
) -> Option<Value> {
    let event = parsed.get("event").and_then(Value::as_str).unwrap_or("");
    match event {
        // Server asks us to confirm the phoenix heartbeat.
        "heartbeat" => Some(json!({
            "topic": "phoenix",
            "event": "heartbeat",
            "payload": {},
            "ref": parsed.get("ref")
        })),
        // Channel join confirmed: tell the app we are subscribed and ready.
        "phx_reply" => {
            let ref_ok = parsed.get("ref").and_then(Value::as_str) == Some("1");
            let status_ok = parsed.pointer("/payload/status").and_then(Value::as_str) == Some("ok");
            if ref_ok && status_ok {
                // try_send: never block the read loop on a full/slow consumer.
                let _ = out_tx.try_send(json!({ "type": "realtime_ready" }));
            }
            None
        }
        // Incoming broadcast: forward inner payload to the app, decrypting the
        // envelope when the phone speaks E2E.
        "broadcast" => {
            if let Some(inner) = parsed.pointer("/payload/payload") {
                if crypto::is_envelope(inner) {
                    match crypto::decrypt_value(key, inner) {
                        Some(plain) => {
                            *peer_encrypted = true;
                            let _ = out_tx.try_send(plain);
                        }
                        None => eprintln!("[realtime] dropping undecryptable payload"),
                    }
                } else {
                    let _ = out_tx.try_send(inner.clone());
                }
            }
            None
        }
        _ => {
            if parsed.get("topic").and_then(Value::as_str) == Some(channel) {
                let _ = out_tx.try_send(parsed);
            }
            None
        }
    }
}

