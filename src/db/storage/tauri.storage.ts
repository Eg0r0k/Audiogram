import { ResultAsync, fromPromise } from "neverthrow";
import {
  writeFile,
  remove,
  mkdir,
  exists,
  BaseDirectory,
  readDir,
  copyFile,
  readFile,
  open,
} from "@tauri-apps/plugin-fs";
import { appDataDir } from "@tauri-apps/api/path";
import { convertFileSrc } from "@tauri-apps/api/core";

import type { IFileStorageWithNativeSupport } from "./IFileStorage";
import { StorageError } from "../errors/storage.errors";

export class TauriStorage implements IFileStorageWithNativeSupport {
  private readonly baseDir = BaseDirectory.AppData;

  private appDataCache: string | null = null;
  private createdDirs = new Set<string>();

  async getAppDataDir(): Promise<string> {
    if (!this.appDataCache) {
      this.appDataCache = await appDataDir();
    }
    return this.appDataCache;
  }

  joinPath(base: string, ...parts: string[]): string {
    const joined = [base, ...parts].join("/");
    return joined.replace(/\\/g, "/").replace(/\/+/g, "/");
  }

  private async ensureDir(folder: string): Promise<void> {
    if (!folder || this.createdDirs.has(folder)) return;

    const folderExists = await exists(folder, { baseDir: this.baseDir });
    if (!folderExists) {
      await mkdir(folder, { baseDir: this.baseDir, recursive: true });
    }
    this.createdDirs.add(folder);
  }

  private isAbsolutePath(path: string): boolean {
    return /^(?:[a-zA-Z]:[\\/]|\/)/.test(path);
  }

  private getFolder(path: string): string {
    const lastSlash = path.lastIndexOf("/");
    return lastSlash > 0 ? path.substring(0, lastSlash) : "";
  }

  async warmup(folders: string[] = ["tracks", "covers"]): Promise<void> {
    await this.getAppDataDir();
    await Promise.all(folders.map(f => this.ensureDir(f)));
  }

  importFile(sourceAbsPath: string, targetRelPath: string): ResultAsync<string, StorageError> {
    return fromPromise((async () => {
      const folder = this.getFolder(targetRelPath);
      await this.ensureDir(folder);
      const appData = await this.getAppDataDir();
      const destPath = `${appData}/${targetRelPath}`.replace(/\\/g, "/").replace(/\/+/g, "/");

      await copyFile(sourceAbsPath, destPath);
      return targetRelPath;
    })(), e => StorageError.writeFailed(targetRelPath, e));
  }

  readFile(absolutePath: string): ResultAsync<Uint8Array, StorageError> {
    return fromPromise(
      readFile(absolutePath),
      e => StorageError.readFailed(absolutePath, e),
    );
  }

  readBytes(absolutePath: string, length: number): ResultAsync<Uint8Array, StorageError> {
    return fromPromise((async () => {
      const file = await open(absolutePath, { read: true });
      try {
        const buffer = new Uint8Array(length);

        const bytesRead = await file.read(buffer);
        const count = bytesRead ?? 0;

        return count < length ? buffer.slice(0, count) : buffer;
      }
      finally {
        await file.close();
      }
    })(), e => StorageError.readFailed(absolutePath, e));
  }

  readFileRaw(absolutePath: string): ResultAsync<Uint8Array, StorageError> {
    return this.readFile(absolutePath);
  }

  clearCaches(): void {
    this.createdDirs.clear();
  }

  saveFile(path: string, data: Blob | ArrayBuffer | Uint8Array): ResultAsync<string, StorageError> {
    return fromPromise((async () => {
      const folder = this.getFolder(path);
      await this.ensureDir(folder);

      let buffer: Uint8Array;
      if (data instanceof Uint8Array) buffer = data;
      else if (data instanceof Blob) buffer = new Uint8Array(await data.arrayBuffer());
      else buffer = new Uint8Array(data);

      await writeFile(path, buffer, { baseDir: this.baseDir });
      return path;
    })(), e => StorageError.writeFailed(path, e));
  }

  getFile(path: string): ResultAsync<Blob, StorageError> {
    return fromPromise(
      readFile(path, { baseDir: this.baseDir }).then(data => new Blob([data])),
      error => StorageError.readFailed(path, error),
    );
  }

  getAudioUrl(path: string): ResultAsync<string, StorageError> {
    return fromPromise(
      (async () => {
        const normalizedPath = path.replace(/\\/g, "/");

        if (this.isAbsolutePath(normalizedPath)) {
          return convertFileSrc(normalizedPath);
        }

        const appData = await this.getAppDataDir();
        return convertFileSrc(this.joinPath(appData, normalizedPath));
      })(),
      error => StorageError.readFailed(path, error),
    );
  }

  listFiles(folder: string): ResultAsync<string[], StorageError> {
    return fromPromise(
      (async () => {
        const folderExists = await exists(folder, { baseDir: this.baseDir });
        if (!folderExists) return [];

        const entries = await readDir(folder, { baseDir: this.baseDir });
        return entries
          .filter(entry => entry.isFile)
          .map(entry => `${folder}/${entry.name}`);
      })(),
      error => StorageError.readFailed(folder, error),
    );
  }

  deleteFile(path: string): ResultAsync<void, StorageError> {
    return fromPromise(
      (async () => {
        const fileExists = await exists(path, { baseDir: this.baseDir });
        if (fileExists) {
          await remove(path, { baseDir: this.baseDir });
        }
      })(),
      error => StorageError.deleteFailed(path, error),
    );
  }
}
