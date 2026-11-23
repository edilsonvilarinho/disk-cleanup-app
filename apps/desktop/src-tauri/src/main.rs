// Sem console extra no Windows em build de release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    disk_cleanup_desktop_lib::run(tauri::generate_context!());
}
