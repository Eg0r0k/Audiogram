import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { ResultAsync } from "neverthrow";

export class AutostartError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "AutostartError";
  }
}

const wrap = <T>(fn: () => Promise<T>, message: string) =>
  ResultAsync.fromPromise(fn(), e => new AutostartError(message, e));

export const autostartService = {
  enable: () => wrap(enable, "Failed to enable autostart"),
  disable: () => wrap(disable, "Failed to disable autostart"),
  isEnabled: () => wrap(isEnabled, "Failed to check autostart state"),
};
