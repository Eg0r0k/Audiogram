import { IS_TAURI } from "@/helpers/environment/userAgent";
import { IFileStorage } from "./IFileStorage";
import { TauriStorage } from "./tauri.storage";
import { WebOpfsStorage } from "./web-opfs.storage";

export const storageService: IFileStorage = IS_TAURI
  ? new TauriStorage()
  : new WebOpfsStorage();
