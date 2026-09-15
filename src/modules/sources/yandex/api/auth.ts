import { COMMANDS, EVENTS, invokeCommand, listenEvent } from "@/app/tauri-commands";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { YmAuthEvent, YmAuthStatus, YmDeviceCode } from "./types";

export const ymAuthStatus = (): Promise<YmAuthStatus> => invokeCommand(COMMANDS.ymAuthStatus);

export const ymAuthStart = (): Promise<YmDeviceCode> => invokeCommand(COMMANDS.ymAuthStart);

export const ymAuthCancel = (): Promise<void> => invokeCommand(COMMANDS.ymAuthCancel);

export const ymAuthLogout = (): Promise<void> => invokeCommand(COMMANDS.ymAuthLogout);

export const onYmAuthEvent = (handler: (event: YmAuthEvent) => void): Promise<UnlistenFn> =>
  listenEvent(EVENTS.ymAuth, event => handler(event.payload));
