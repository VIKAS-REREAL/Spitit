// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use windows::Win32::Foundation::ERROR_ALREADY_EXISTS;
use windows::Win32::System::Threading::CreateMutexW;
use windows::Win32::UI::WindowsAndMessaging::{
    FindWindowW, IsIconic, SetForegroundWindow, ShowWindow, SW_RESTORE, SW_SHOW,
};
use windows::core::w;

fn main() {
    unsafe {
        let _mutex = CreateMutexW(None, true, w!("Global\\REREAL_Spitit_v3_SingleInstanceMutex"));
        if windows::Win32::Foundation::GetLastError() == ERROR_ALREADY_EXISTS {
            if let Ok(hwnd) = FindWindowW(None, w!("spitit-v3")) {
                if !hwnd.0.is_null() {
                    if IsIconic(hwnd).as_bool() {
                        let _ = ShowWindow(hwnd, SW_RESTORE);
                    } else {
                        let _ = ShowWindow(hwnd, SW_SHOW);
                    }
                    let _ = SetForegroundWindow(hwnd);
                }
            }
            std::process::exit(0);
        }
    }

    spitit_v3_lib::run()
}
