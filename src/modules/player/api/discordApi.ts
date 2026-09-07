import { COMMANDS, invokeCommand } from "@/app/tauri-commands";
import type { DiscordActivityPayload } from "../utils/discordPresence";

export const setDiscordActivity = (payload: DiscordActivityPayload): Promise<void> =>
  invokeCommand(COMMANDS.discordSetActivity, { payload });

export const clearDiscordActivity = (): Promise<void> =>
  invokeCommand(COMMANDS.discordClearActivity);
