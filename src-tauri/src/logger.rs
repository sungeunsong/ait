use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;

lazy_static::lazy_static! {
    static ref LOG_FILE: Mutex<Option<PathBuf>> = Mutex::new(None);
}

pub fn init_logger(log_dir: PathBuf) {
    let log_path = log_dir.join("ait.log");

    // Save path for later use
    *LOG_FILE.lock().unwrap() = Some(log_path.clone());

    // Write initial header
    if let Ok(mut file) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&log_path)
    {
        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
        let _ = writeln!(file, "\n========== AIT Started at {} ==========", timestamp);
    }
}

/// Write a message to the log file (used by macros)
pub fn write_log(message: &str) {
    if let Some(path) = LOG_FILE.lock().unwrap().as_ref() {
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
        {
            let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
            let _ = writeln!(file, "[{}] {}", timestamp, message);
            let _ = file.flush();
        }
    }
}

/// Log to both console and file
#[macro_export]
macro_rules! log {
    ($($arg:tt)*) => {
        {
            let msg = format!($($arg)*);
            println!("{}", msg);
            $crate::logger::write_log(&msg);
        }
    };
}
