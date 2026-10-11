// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Single instance management is handled canonically by tauri_plugin_single_instance in lib.rs
    spitit_v3_lib::run()
}
