mod monitor;

use monitor::{Monitor, SystemStats};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, State};

/// Event the console subscribes to. One payload per sample.
const STATS_EVENT: &str = "system-stats";
const SAMPLE_INTERVAL: Duration = Duration::from_secs(1);

/// One-shot reading. The console calls this once on mount so the panel has
/// something to show before the first event arrives.
#[tauri::command]
fn get_system_stats(monitor: State<'_, Monitor>) -> Result<SystemStats, String> {
    monitor.sample()
}

/// Signal a process. `force` escalates SIGTERM to SIGKILL.
#[tauri::command]
fn kill_process(pid: u32, force: bool, monitor: State<'_, Monitor>) -> Result<(), String> {
    monitor.kill(pid, force)
}

/// Sample on a fixed cadence and push each snapshot to the frontend.
fn spawn_sampler(app: AppHandle) {
    std::thread::spawn(move || loop {
        match app.state::<Monitor>().sample() {
            Ok(stats) => {
                if app.emit(STATS_EVENT, stats).is_err() {
                    break; // no listeners left; the app is shutting down
                }
            }
            Err(err) => eprintln!("[monitor] sample failed: {err}"),
        }
        std::thread::sleep(SAMPLE_INTERVAL);
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Monitor::new())
        .setup(|app| {
            spawn_sampler(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_system_stats, kill_process])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
