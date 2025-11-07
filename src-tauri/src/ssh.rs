use ssh2::Session;
use std::{
    collections::HashMap,
    io::{Read, Write},
    net::TcpStream,
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};
use tauri::{command, Emitter, WebviewWindow};
use uuid::Uuid;

struct ShellSession {
    #[allow(dead_code)]
    sess: Session,
    channel: ssh2::Channel,
}

lazy_static::lazy_static! {
    static ref SHELLS: Mutex<HashMap<String, Arc<Mutex<ShellSession>>>> =
        Mutex::new(HashMap::new());
}

// 여기서 AppHandle 말고 WebviewWindow 받는다!
#[command]
pub fn ssh_open_shell(
    window: WebviewWindow,
    host: String,
    port: u16,
    user: String,
    password: String,
    cols: Option<u32>,
    rows: Option<u32>,
) -> Result<String, String> {
    println!("[ssh_open_shell] start");

    let addr = format!("{}:{}", host, port);
    let tcp =
        TcpStream::connect(&addr).map_err(|e| format!("TCP connect error to {}: {}", addr, e))?;
    tcp.set_read_timeout(Some(Duration::from_secs(15))).ok();
    tcp.set_write_timeout(Some(Duration::from_secs(15))).ok();

    // ssh2 0.10+
    let mut sess = Session::new().map_err(|e| format!("Session::new FAIL: {e}"))?;
    sess.set_tcp_stream(tcp);
    sess.handshake()
        .map_err(|e| format!("SSH handshake error: {}", e))?;
    sess.userauth_password(&user, &password)
        .map_err(|e| format!("SSH auth error: {}", e))?;
    if !sess.authenticated() {
        return Err("SSH authentication failed".into());
    }

    let mut channel = sess
        .channel_session()
        .map_err(|e| format!("failed to open channel: {}", e))?;

    // PTY 크기 설정 (기본값: 80x24)
    let pty_cols = cols.unwrap_or(80);
    let pty_rows = rows.unwrap_or(24);

    channel
        .request_pty("xterm", None, Some((pty_cols, pty_rows, 0, 0)))
        .map_err(|e| format!("failed to request pty: {}", e))?;
    channel
        .shell()
        .map_err(|e| format!("failed to start shell: {}", e))?;

    // 세션 전체 non-blocking
    sess.set_blocking(false);

    let id = Uuid::new_v4().to_string();
    let shell = Arc::new(Mutex::new(ShellSession { sess, channel }));
    {
        let mut map = SHELLS.lock().unwrap();
        map.insert(id.clone(), shell.clone());
    }

    // 이 창을 스레드로 넘길 거라 clone
    let win_for_thread = window.clone();
    let shell_for_thread = shell.clone();
    let id_for_thread = id.clone();

    thread::spawn(move || {
        println!("[ssh_reader:{}] started", id_for_thread);
        let mut buf = [0u8; 1024];

        loop {
            let mut guard = match shell_for_thread.lock() {
                Ok(g) => g,
                Err(_) => break,
            };

            match guard.channel.read(&mut buf) {
                Ok(0) => {
                    // EOF
                    let _ = win_for_thread.emit_to(
                        &win_for_thread.label(),
                        "ssh:data",
                        serde_json::json!({
                            "id": id_for_thread,
                            "data": "[session closed]\r\n",
                        }),
                    );
                    println!("[ssh_reader:{}] EOF", id_for_thread);
                    break;
                }
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = win_for_thread.emit_to(
                        &win_for_thread.label(),
                        "ssh:data",
                        serde_json::json!({
                            "id": id_for_thread,
                            "data": chunk,
                        }),
                    );
                }
                Err(e) => {
                    if e.kind() == std::io::ErrorKind::WouldBlock {
                        // 읽을 게 없으면 잠깐 쉼
                    } else {
                        let _ = win_for_thread.emit_to(
                            &win_for_thread.label(),
                            "ssh:data",
                            serde_json::json!({
                                "id": id_for_thread,
                                "data": format!("[read error: {}]\r\n", e),
                            }),
                        );
                        println!("[ssh_reader:{}] read error: {}", id_for_thread, e);
                        break;
                    }
                }
            }

            drop(guard);
            thread::sleep(Duration::from_millis(10));
        }
    });

    println!("[ssh_open_shell] return id={}", id);
    Ok(id)
}

#[command]
pub fn ssh_write(id: String, data: String) -> Result<(), String> {
    let map = SHELLS.lock().unwrap();
    let shell = map
        .get(&id)
        .ok_or_else(|| format!("session {} not found", id))?;
    let mut shell = shell.lock().unwrap();

    shell
        .channel
        .write_all(data.as_bytes())
        .map_err(|e| format!("write error: {}", e))?;
    shell
        .channel
        .flush()
        .map_err(|e| format!("flush error: {}", e))?;

    Ok(())
}

#[command]
pub fn ssh_resize(id: String, cols: u32, rows: u32) -> Result<(), String> {
    let map = SHELLS.lock().unwrap();
    let shell = map
        .get(&id)
        .ok_or_else(|| format!("session {} not found", id))?;
    let mut shell = shell.lock().unwrap();

    shell
        .channel
        .request_pty_size(cols, rows, None, None)
        .map_err(|e| format!("resize error: {}", e))?;

    Ok(())
}

#[command]
pub fn ssh_close(id: String) -> Result<(), String> {
    let mut map = SHELLS.lock().unwrap();
    if let Some(shell) = map.remove(&id) {
        if let Ok(mut s) = shell.lock() {
            let _ = s.channel.close();
        }
        Ok(())
    } else {
        Err(format!("session {} not found", id))
    }
}
