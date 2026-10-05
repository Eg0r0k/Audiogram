import { getCurrentWindow } from "@tauri-apps/api/window";
import { COMMANDS, invokeCommand } from "@/app/tauri-commands";

export type StartupWindow = "show" | "tray" | "taskbar";

export interface StartupSettings {
  launchMinimized: boolean;
  closeToTray: boolean;
}

/** Only a launch at login can start minimized; it goes where Close to tray points. */
export const decideStartupWindow = ({ autostart, launchMinimized, closeToTray }: StartupSettings & { autostart: boolean }): StartupWindow => {
  if (!autostart || !launchMinimized) return "show";
  return closeToTray ? "tray" : "taskbar";
};

/**
 * The window is created hidden; Rust shows it on ordinary launches, so only
 * an autostart launch is decided here, after the settings are known.
 */
export const applyStartupWindow = async (settings: StartupSettings): Promise<void> => {
  const { autostart } = await invokeCommand(COMMANDS.launchContext);
  if (!autostart) return;
  const window = getCurrentWindow();
  switch (decideStartupWindow({ autostart, ...settings })) {
    case "show":
      await window.show();
      await window.setFocus();
      break;
    case "taskbar":
      await window.minimize();
      break;
    case "tray":
      break;
  }
};
