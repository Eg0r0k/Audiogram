//! Tells WebView2 when the main window is minimized or hidden to the tray.
//!
//! wry never sets `ICoreWebView2Controller::IsVisible` on its own, so the page
//! of a minimized or tray-hidden window stays `visible` and keeps drawing
//! every running animation at the display rate (~15 % GPU in the tray for
//! one animated sidebar tile). Hidden, the page behaves like a background
//! tab: no frames and no rAF, while audio keeps playing.

/// Starts mirroring the main window state into the page. No-op outside
/// Windows: WebKit stops drawing a minimized or hidden view by itself.
pub fn setup(app: &tauri::App) -> tauri::Result<()> {
    imp::setup(app)
}

#[cfg(not(windows))]
mod imp {
    #[allow(clippy::unnecessary_wraps)]
    pub fn setup(_app: &tauri::App) -> tauri::Result<()> {
        Ok(())
    }
}

#[cfg(windows)]
mod imp {
    use std::cell::RefCell;
    use std::rc::Rc;
    use tauri::Manager;
    use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
    use windows::Win32::UI::WindowsAndMessaging::{
        IsIconic, IsWindowVisible, WM_NCDESTROY, WM_WINDOWPOSCHANGED,
    };

    // Distinct from the thumbbar subclass on the same window.
    const SUBCLASS_ID: usize = 0x4147_5756; // "AGWV"

    type SetVisible = Rc<dyn Fn(bool)>;

    struct Page {
        set_visible: SetVisible,
        visible: bool,
    }

    // Main thread only: the subclass runs there, and the controller is
    // apartment-bound.
    thread_local! {
        static PAGE: RefCell<Option<Page>> = const { RefCell::new(None) };
    }

    pub fn setup(app: &tauri::App) -> tauri::Result<()> {
        let Some(window) = app.get_webview_window("main") else {
            return Ok(());
        };
        let target = window.clone();
        window.with_webview(move |webview| {
            let Ok(hwnd) = target.hwnd() else {
                return;
            };
            let controller = webview.controller();
            install(
                hwnd,
                Rc::new(move |visible| {
                    if let Err(e) = unsafe { controller.SetIsVisible(visible) } {
                        log::warn!("webview visibility: SetIsVisible({visible}) failed: {e}");
                    }
                }),
            );
        })
    }

    fn install(hwnd: HWND, set_visible: SetVisible) -> bool {
        // wry creates the controller visible.
        PAGE.set(Some(Page {
            set_visible,
            visible: true,
        }));
        if !unsafe { SetWindowSubclass(hwnd, Some(subclass_proc), SUBCLASS_ID, 0) }.as_bool() {
            log::warn!("webview visibility: SetWindowSubclass failed");
            PAGE.set(None);
            return false;
        }
        sync(hwnd);
        true
    }

    // Show, hide, minimize and restore all end in WM_WINDOWPOSCHANGED, sent
    // once the window already reports its new state. WM_SHOWWINDOW comes
    // before the change, and minimizing sends none.
    unsafe extern "system" fn subclass_proc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _uid: usize,
        _ref_data: usize,
    ) -> LRESULT {
        let result = unsafe { DefSubclassProc(hwnd, msg, wparam, lparam) };
        match msg {
            WM_WINDOWPOSCHANGED => sync(hwnd),
            // Releases the controller together with the window instead of at
            // thread exit, after WebView2 is gone.
            WM_NCDESTROY => {
                let _ = unsafe { RemoveWindowSubclass(hwnd, Some(subclass_proc), SUBCLASS_ID) };
                PAGE.set(None);
            }
            _ => {}
        }
        result
    }

    fn sync(hwnd: HWND) {
        let visible = unsafe { IsWindowVisible(hwnd).as_bool() && !IsIconic(hwnd).as_bool() };
        // Call out of the borrow: the controller may pump messages back into
        // this subclass, and a live RefCell borrow there would panic.
        let set_visible = PAGE.with_borrow_mut(|page| {
            let page = page.as_mut().filter(|page| page.visible != visible)?;
            page.visible = visible;
            Some(Rc::clone(&page.set_visible))
        });
        if let Some(set_visible) = set_visible {
            set_visible(visible);
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use windows::core::w;
        use windows::Win32::UI::WindowsAndMessaging::{
            CreateWindowExW, DestroyWindow, SetWindowPos, ShowWindow, SWP_NOACTIVATE, SWP_NOSIZE,
            SWP_NOZORDER, SW_HIDE, SW_SHOWMINNOACTIVE, SW_SHOWNOACTIVATE, WS_EX_NOACTIVATE,
            WS_EX_TOOLWINDOW, WS_POPUP,
        };

        // A real off-screen window without a taskbar button: ShowWindow and
        // SetWindowPos deliver their messages synchronously on the owning
        // thread, so no message loop is needed.
        fn test_window() -> HWND {
            unsafe {
                CreateWindowExW(
                    WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE,
                    w!("STATIC"),
                    w!(""),
                    WS_POPUP,
                    -10_000,
                    -10_000,
                    1,
                    1,
                    None,
                    None,
                    None,
                    None,
                )
            }
            .expect("create test window")
        }

        fn recorder() -> (SetVisible, Rc<RefCell<Vec<bool>>>) {
            let calls = Rc::new(RefCell::new(Vec::new()));
            let sink = Rc::clone(&calls);
            (
                Rc::new(move |visible| sink.borrow_mut().push(visible)),
                calls,
            )
        }

        #[test]
        fn page_follows_show_minimize_restore_and_hide() {
            let hwnd = test_window();
            let (set_visible, calls) = recorder();

            assert!(install(hwnd, set_visible));
            unsafe {
                let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
                let _ = ShowWindow(hwnd, SW_SHOWMINNOACTIVE);
                let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
                let _ = ShowWindow(hwnd, SW_HIDE);
            }
            let seen = calls.borrow().clone();
            unsafe { DestroyWindow(hwnd) }.expect("destroy test window");

            // The first `false` is the sync on install: the window starts
            // hidden while the controller starts visible.
            assert_eq!(seen, [false, true, false, true, false]);
        }

        #[test]
        fn moving_a_visible_window_does_not_touch_the_page() {
            let hwnd = test_window();
            let (set_visible, calls) = recorder();

            assert!(install(hwnd, set_visible));
            unsafe {
                let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
                let _ = SetWindowPos(
                    hwnd,
                    None,
                    -9_000,
                    -9_000,
                    0,
                    0,
                    SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE,
                );
            }
            let seen = calls.borrow().clone();
            unsafe { DestroyWindow(hwnd) }.expect("destroy test window");

            assert_eq!(seen, [false, true]);
        }

        #[test]
        fn a_window_hidden_while_minimized_stays_hidden_until_restored() {
            let hwnd = test_window();
            let (set_visible, calls) = recorder();

            assert!(install(hwnd, set_visible));
            unsafe {
                let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
                let _ = ShowWindow(hwnd, SW_SHOWMINNOACTIVE);
                let _ = ShowWindow(hwnd, SW_HIDE);
                let _ = ShowWindow(hwnd, SW_SHOWMINNOACTIVE);
                let _ = ShowWindow(hwnd, SW_SHOWNOACTIVATE);
            }
            let seen = calls.borrow().clone();
            unsafe { DestroyWindow(hwnd) }.expect("destroy test window");

            assert_eq!(seen, [false, true, false, true]);
        }

        #[test]
        fn destroying_the_window_releases_the_controller() {
            let hwnd = test_window();
            let (set_visible, _calls) = recorder();
            let held = Rc::downgrade(&set_visible);

            assert!(install(hwnd, set_visible));
            unsafe { DestroyWindow(hwnd) }.expect("destroy test window");

            assert!(held.upgrade().is_none());
        }
    }
}
