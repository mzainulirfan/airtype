use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;

pub enum RealtimeCommand {
    Send(Value),
    Stop,
}

/// Spawn a background task that keeps a Supabase Realtime connection alive,
/// forwards incoming broadcasts through `out_tx` and applies commands.
/// Returns a handle that can be aborted to stop the task (and close the socket).
pub fn spawn_realtime(
    ws_url: String,
    channel: String,
    access_token: String,
    out_tx: mpsc::Sender<Value>,
    cmd_rx: mpsc::Receiver<RealtimeCommand>,
) -> tauri::async_runtime::JoinHandle<()> {
    tauri::async_runtime::spawn(async move {
        let mut cmd_rx = cmd_rx;
        let mut retry = 1u64;
        loop {
            let clean = run_connection(&ws_url, &channel, &access_token, out_tx.clone(), &mut cmd_rx)
                .await;
            if clean {
                eprintln!("[realtime] connection ended cleanly");
                break;
            }
            let delay = (retry * 2).min(30);
            tokio::time::sleep(Duration::from_secs(delay)).await;
            retry += 1;
        }
    })
}

/// Returns true if the connection ended cleanly (no retry needed).
async fn run_connection(
    ws_url: &str,
    channel: &str,
    access_token: &str,
    out_tx: mpsc::Sender<Value>,
    cmd_rx: &mut mpsc::Receiver<RealtimeCommand>,
) -> bool {
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

    loop {
        tokio::select! {
            incoming = stream.next() => {
                match incoming {
                    Some(Ok(Message::Text(text))) => {
                        let parsed: Value = match serde_json::from_str(&text) {
                            Ok(v) => v,
                            Err(_) => continue,
                        };
                        match handle_message(parsed, channel, out_tx.clone()).await {
                            Some(reply) => {
                                if sink.send(Message::Text(reply.to_string().into())).await.is_err() {
                                    return false;
                                }
                            }
                            None => {}
                        }
                    }
                    Some(Ok(_)) => {}
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
                        let msg = json!({
                            "topic": channel,
                            "event": "broadcast",
                            "payload": {
                                "type": "broadcast",
                                "event": "airtype",
                                "payload": payload
                            },
                            "ref": null
                        });
                        if sink.send(Message::Text(msg.to_string().into())).await.is_err() {
                            return false;
                        }
                    }
                    Some(RealtimeCommand::Stop) => {
                        let _ = sink.send(Message::Close(None)).await;
                        return true;
                    }
                    None => return true,
                }
            }
        }
    }
}

/// Process one inbound JSON message. Returns an optional reply to send back.
async fn handle_message(
    parsed: Value,
    channel: &str,
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
                let _ = out_tx.send(json!({ "type": "realtime_ready" })).await;
            }
            None
        }
        // Incoming broadcast: forward inner payload to the app.
        "broadcast" => {
            if let Some(inner) = parsed.pointer("/payload/payload") {
                let _ = out_tx.send(inner.clone()).await;
            }
            None
        }
        _ => {
            if parsed.get("topic").and_then(Value::as_str) == Some(channel) {
                let _ = out_tx.send(parsed).await;
            }
            None
        }
    }
}

