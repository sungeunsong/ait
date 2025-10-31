use ssh2::Session;
use std::{
    collections::HashMap,
    fmt::format,
    io::{Read, Write},
    net::TcpStream,
    sync::{Arc, Mutex},
    thread,
    time::Duration,
};
use tauri::{command, AppHandle, Emitter};
use uuid::Uuid;

// #[derive(Debug)]
struct ShellSession {
    sess: Session,
    channel: ssh2::Channel,
}

lazy_static::lazy_static! {
    static ref SHELLS: Mutex<HashMap<String, Arc<Mutex<ShellSession>>>> =
        Mutex::new(HashMap::new());
}

/// 1) 인터랙티브 셸 열기
#[command]
pub fn ssh_open_shell(
    app: tauri::AppHandle,
    host: String,
    port: u16,
    user: String,
    password: String,
) -> Result<String, String> {
    println!("[ssh_open_shell] start");
    let addr = format!("{}:{}", host, port);
    let tcp =
        TcpStream::connect(&addr).map_err(|e| format!("TCP connect error to {}: {}", addr, e))?;
    tcp.set_read_timeout(Some(Duration::from_secs(15))).ok();
    tcp.set_write_timeout(Some(Duration::from_secs(15))).ok();

    let mut sess = match Session::new() {
        Ok(s) => s,
        Err(e) => {
            println!("[ssh_open_shell] Session::new FAIL: {}", e);
            return Err(format!("failed to create SSH session: {}", e));
        }
    };
    sess.set_tcp_stream(tcp);
    if let Err(e) = sess.handshake() {
        println!("[ssh_open_shell] handshake FAIL: {}", e);
        return Err(format!("SSH handshake error: {}", e));
    }
    println!("[ssh_open_shell] handshake OK");

    if let Err(e) = sess.userauth_password(&user, &password) {
        println!("[ssh_open_shell] auth FAIL: {}", e);
        return Err(format!("SSH auth error: {}", e));
    }
    if !sess.authenticated() {
        println!("[ssh_open_shell] authenticated() == false");
        return Err("SSH authentication failed".into());
    }
    println!("[ssh_open_shell] auth OK");

    // 4) 채널 + PTY + 쉘
    let mut channel = match sess.channel_session() {
        Ok(ch) => {
            println!("[ssh_open_shell] channel_session OK");
            ch
        }
        Err(e) => {
            println!("[ssh_open_shell] channel_session FAIL: {}", e);
            return Err(format!("failed to open channel: {}", e));
        }
    };

    if let Err(e) = channel.request_pty("xterm", None, None) {
        println!("[ssh_open_shell] request_pty FAIL: {}", e);
        return Err(format!("failed to request pty: {}", e));
    }
    println!("[ssh_open_shell] request_pty OK");

    if let Err(e) = channel.shell() {
        println!("[ssh_open_shell] shell() FAIL: {}", e);
        return Err(format!("failed to start shell: {}", e));
    }
    println!("[ssh_open_shell] shell() OK");

    // 5) 세션 저장
    let id = Uuid::new_v4().to_string();
    let shell = Arc::new(Mutex::new(ShellSession { sess, channel }));

    {
        let mut shells = SHELLS.lock().unwrap();
        shells.insert(id.clone(), shell.clone());
    }
    println!("[ssh_open_shell] session stored with id={}", id);

    // 6) 읽기 스레드
    let id_for_thread = id.clone();
    let app_for_thread = app.clone();
    let shell_for_thread = shell.clone();

    thread::spawn(move || {
        println!("[ssh_reader:{}] started", id_for_thread);
        let mut buf = [0u8; 1024];
        loop {
            let mut guard = match shell_for_thread.lock() {
                Ok(g) => g,
                Err(_) => {
                    println!("[ssh_reader:{}] lock poisoned, stop", id_for_thread);
                    break;
                }
            };

            match guard.channel.read(&mut buf) {
                Ok(0) => {
                    // EOF
                    let _ = app_for_thread.emit_to(
                        "main",
                        "ssh:data",
                        serde_json::json!({
                            "id": id_for_thread,
                            "data": "[session closed]",
                        }),
                    );
                    println!("[ssh_reader:{}] EOF", id_for_thread);
                    break;
                }
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = app_for_thread.emit_to(
                        "main",
                        "ssh:data",
                        serde_json::json!({
                            "id": id_for_thread,
                            "data": chunk,
                        }),
                    );
                    println!("[ssh_reader:{}] chunk={:?}", id_for_thread, &chunk);
                }
                Err(e) => {
                    let _ = app_for_thread.emit_to(
                        "main",
                        "ssh:data",
                        serde_json::json!({
                            "id": id_for_thread,
                            "data": format!("[read error: {}]", e),
                        }),
                    );
                    println!("[ssh_reader:{}] read error: {}", id_for_thread, e);
                    break;
                }
            }

            std::thread::sleep(Duration::from_millis(10));
        }
    });

    println!("[ssh_open_shell] return id={}", id);
    Ok(id)
}

/// 2) 프론트에서 온 입력을 SSH로 보내기
#[command]
pub fn ssh_write(id: String, data: String) -> Result<(), String> {
    let shells = SHELLS.lock().unwrap();
    let shell = shells
        .get(&id)
        .ok_or_else(|| "session not found".to_string())?;
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

/// 3) 셀 닫기
#[command]
pub fn ssh_close(id: String) -> Result<(), String> {
    let mut shells = SHELLS.lock().unwrap();
    if let Some(shell) = shells.remove(&id) {
        if let Ok(mut s) = shell.lock() {
            let _ = s.channel.close();
        }
        Ok(())
    } else {
        Err("session not found".into())
    }
}

#[tauri::command]
pub fn test_emit(app: tauri::AppHandle) -> Result<String, String> {
    println!("[test_emit] called");
    app.emit_to(
        "main",
        "ssh:data",
        serde_json::json!({
            "id": "test",
            "data": "🔥 Hello from Rust! (event)\r\n",
        }),
    )
    .map_err(|e| e.to_string())?;

    Ok("emitted".to_string())
}
