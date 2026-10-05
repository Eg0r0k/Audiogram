import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeCommand = vi.fn();
vi.mock("@/app/tauri-commands", () => ({
  COMMANDS: { launchContext: "launch_context" },
  invokeCommand: (...args: unknown[]) => invokeCommand(...args),
}));

const windowApi = { show: vi.fn(), setFocus: vi.fn(), minimize: vi.fn() };
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => windowApi }));

const { applyStartupWindow, decideStartupWindow } = await import("../services/startup-window");

describe("decideStartupWindow", () => {
  it.each([
    [false, false, false, "show"],
    [false, true, true, "show"],
    [true, false, true, "show"],
    [true, true, true, "tray"],
    [true, true, false, "taskbar"],
  ] as const)("autostart=%s launchMinimized=%s closeToTray=%s -> %s", (autostart, launchMinimized, closeToTray, expected) => {
    expect(decideStartupWindow({ autostart, launchMinimized, closeToTray })).toBe(expected);
  });
});

describe("applyStartupWindow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("leaves an ordinary launch to Rust, which has shown the window already", async () => {
    invokeCommand.mockResolvedValue({ autostart: false });
    await applyStartupWindow({ launchMinimized: true, closeToTray: true });
    expect(windowApi.show).not.toHaveBeenCalled();
    expect(windowApi.minimize).not.toHaveBeenCalled();
  });

  it("opens the window on an autostart launch with Launch minimized off", async () => {
    invokeCommand.mockResolvedValue({ autostart: true });
    await applyStartupWindow({ launchMinimized: false, closeToTray: true });
    expect(windowApi.show).toHaveBeenCalled();
    expect(windowApi.setFocus).toHaveBeenCalled();
  });

  it("stays in the tray when Close to tray is on", async () => {
    invokeCommand.mockResolvedValue({ autostart: true });
    await applyStartupWindow({ launchMinimized: true, closeToTray: true });
    expect(windowApi.show).not.toHaveBeenCalled();
    expect(windowApi.minimize).not.toHaveBeenCalled();
  });

  it("minimizes to the taskbar when Close to tray is off", async () => {
    invokeCommand.mockResolvedValue({ autostart: true });
    await applyStartupWindow({ launchMinimized: true, closeToTray: false });
    expect(windowApi.minimize).toHaveBeenCalled();
    expect(windowApi.setFocus).not.toHaveBeenCalled();
  });
});
