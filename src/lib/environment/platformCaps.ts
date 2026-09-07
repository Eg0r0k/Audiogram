import { IS_MOBILE, IS_TAURI, IS_WINDOWS } from "./userAgent";

// Platform capabilities — what this runtime can do, not what it is. Gate
// features on these instead of raw IS_TAURI checks; UI cosmetics may keep
// IS_TAURI.

export const platformCaps = {
  /** Native filesystem: managed storage, offline copies, watched folders. */
  hasFs: IS_TAURI,
  /** Loopback media server: local file streaming, `.ape` transcoding. */
  hasMediaServer: IS_TAURI,
  /** Rust-side HTTP proxy setting shared by the Innertube and stream clients. */
  hasNativeProxy: IS_TAURI,
  /** plugin-log transport: log files on disk, tail and export. */
  hasNativeLog: IS_TAURI,
  /** plugin-opener for external links (desktop and Android intents). */
  hasNativeOpener: IS_TAURI,
  /** Global media hotkeys (plugin-global-shortcut, desktop only). */
  hasGlobalShortcuts: IS_TAURI && !IS_MOBILE,
  /** Launch at OS startup (plugin-autostart, desktop only). */
  hasAutostart: IS_TAURI && !IS_MOBILE,
  /** Browser document Picture-in-Picture window (web desktop only). */
  hasDocumentPip: !IS_TAURI && !IS_MOBILE && typeof window !== "undefined" && "documentPictureInPicture" in window,
  /** Spawning helper processes (yt-dlp). */
  canShellSpawn: IS_TAURI && !IS_MOBILE,
  /** Proxying remote streams/covers through the Rust `stream://` layer. */
  canProxyStream: IS_TAURI,
  /** Discord Rich Presence over local IPC. */
  hasDiscord: IS_TAURI && !IS_MOBILE,
  /** Native window integration: title updates, tray. */
  hasNativeWindow: IS_TAURI && !IS_MOBILE,
  /** In-app updates: the desktop updater plugin or the Android APK flow. */
  hasAppUpdater: IS_TAURI,
  /** Webview zoom control (desktop webviews only). */
  hasZoom: IS_TAURI && !IS_MOBILE,
  /** Windows taskbar thumbnail toolbar (like / prev / play-pause / next). */
  hasTaskbarThumbbar: IS_TAURI && !IS_MOBILE && IS_WINDOWS,
} as const;

export type PlatformCaps = typeof platformCaps;
