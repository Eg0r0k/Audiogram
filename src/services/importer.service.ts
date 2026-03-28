import pLimit from "p-limit";
import { ResultAsync } from "neverthrow";
import { open } from "@tauri-apps/plugin-dialog";
import { stat } from "@tauri-apps/plugin-fs";

import MetaWorker from "@/workers/meta.worker?worker";
import { db } from "@/db/index";
import type { BaseMetadata, ParseResponse } from "@/workers/types";
import { normalizeMetadata, type NormalizedMeta } from "@/lib/metadata";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { storageService } from "@/db/storage";
import {
  hasNativeSupport,
  type IFileStorageWithNativeSupport,
} from "@/db/storage/IFileStorage";
import { TrackSource, TrackState } from "@/db/entities";
import type { StorageError } from "@/db/errors/storage.errors";
import { isValidImportItem } from "@/lib/environment/mimeSupport";
import { TimeProfiler } from "@/lib/profiler";
import { ScannedFile, SyncResult, WatchedFolder } from "@/modules/watched-folders/types";
import { scanFolder } from "@/modules/watched-folders/services/folder-scanner";
import { computeFileFingerprint, computeFileFingerprintFromBlob } from "@/modules/watched-folders/services/file-fingerprint";

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════

const HEAD_READ_SIZE = 512 * 1024;
const WORKER_TIMEOUT = 20_000;
const WORKER_POOL_SIZE = Math.min(navigator.hardwareConcurrency || 4, 8);
const PROCESS_CONCURRENCY = 8;
const DB_BATCH_SIZE = 40;

// ═══════════════════════════════════════════════════════
// ERRORS
// ═══════════════════════════════════════════════════════

export enum ImportErrorCode {
  PARSE_FAILED = "PARSE_FAILED",
  STORAGE_FAILED = "STORAGE_FAILED",
  DATABASE_FAILED = "DATABASE_FAILED",
  WORKER_TIMEOUT = "WORKER_TIMEOUT",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  UNSUPPORTED_FORMAT = "UNSUPPORTED_FORMAT",
  NATIVE_IMPORT_UNAVAILABLE = "NATIVE_IMPORT_UNAVAILABLE",
  READ_FAILED = "READ_FAILED",
}

export class ImportError extends Error {
  constructor(
    public readonly code: ImportErrorCode,
    message: string,
    public readonly fileName?: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ImportError";
  }

  static parseFailed(fileName: string, cause?: unknown): ImportError {
    return new ImportError(ImportErrorCode.PARSE_FAILED, `Parse failed: ${fileName}`, fileName, cause);
  }

  static storageFailed(fileName: string, cause?: unknown): ImportError {
    return new ImportError(ImportErrorCode.STORAGE_FAILED, `Storage failed: ${fileName}`, fileName, cause);
  }

  static databaseFailed(fileName: string, cause?: unknown): ImportError {
    return new ImportError(ImportErrorCode.DATABASE_FAILED, `DB failed: ${fileName}`, fileName, cause);
  }

  static workerTimeout(fileName: string): ImportError {
    return new ImportError(ImportErrorCode.WORKER_TIMEOUT, `Timeout: ${fileName}`, fileName);
  }

  static unsupportedFormat(fileName: string, format: string): ImportError {
    return new ImportError(ImportErrorCode.UNSUPPORTED_FORMAT, `Unsupported: ${format}: ${fileName}`, fileName);
  }

  static readFailed(fileName: string, cause?: unknown): ImportError {
    return new ImportError(ImportErrorCode.READ_FAILED, `Read failed: ${fileName}`, fileName, cause);
  }

  static nativeImportUnavailable(fileName: string): ImportError {
    return new ImportError(ImportErrorCode.NATIVE_IMPORT_UNAVAILABLE, `Native import unavailable: ${fileName}`, fileName);
  }
}

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

export interface ImportSuccess {
  trackId: TrackId;
  fileName: string;
  title: string;
  artist: string;
  album: string;
}

export interface ImportBatchResult {
  successful: ImportSuccess[];
  failed: Array<{ fileName: string; error: ImportError }>;
  skipped: number;
  total: number;
  timings?: Record<string, number>;
}

interface ImportItem {
  type: "native" | "web";
  name: string;
  ext: string;
  file?: File;
  path?: string;
  fileSize: number;
  fingerprint?: string;
}

interface TrackToSave {
  trackId: TrackId;
  fileName: string;
  storagePath: string;
  fingerprint: string;
  source: TrackSource;
  meta: NormalizedMeta;
}

interface PendingWorkerRequest {
  resolve: (meta: BaseMetadata) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface SessionCache {
  artists: Map<string, ArtistId>;
  albums: Map<string, { id: AlbumId; isNew: boolean }>;
}

// ═══════════════════════════════════════════════════════
// MUSIC LIBRARY ENGINE
// ═══════════════════════════════════════════════════════

export class MusicLibraryEngine {
  private workerPool: Worker[] = [];
  private workerIndex = 0;
  private pendingRequests = new Map<string, PendingWorkerRequest>();
  private limit = pLimit(PROCESS_CONCURRENCY);
  private sessionCache: SessionCache = {
    artists: new Map(),
    albums: new Map(),
  };

  private profiler = new TimeProfiler();

  constructor() {
    this.initWorkerPool();
  }

  // ═══════════════════════════════════════════════════════
  // PUBLIC — LIBRARY IMPORT (copies into internal storage)
  // ═══════════════════════════════════════════════════════

  get isNativeImportAvailable(): boolean {
    return hasNativeSupport(storageService);
  }

  async pickFiles(): Promise<string[] | null> {
    const result = await open({
      multiple: true,
      title: "Выберите аудио файлы",
      filters: [{
        name: "Audio",
        extensions: [
          "mp3", "flac", "wav", "ogg",
          "m4a", "aac", "opus", "wma", "alac",
        ],
      }],
    });
    if (!result) return null;
    return Array.isArray(result) ? result : [result];
  }

  async importFromPaths(
    paths: string[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<ImportBatchResult> {
    if (!hasNativeSupport(storageService)) {
      return this.createEmptyFailResult(paths, "Native support missing");
    }

    this.profiler.start("0_warmup");
    await storageService.warmup(["tracks"]);
    this.profiler.end("0_warmup");

    const items: ImportItem[] = await Promise.all(
      paths.map(async (path) => {
        const name = path.split(/[\\/]/).pop() ?? "unknown";
        let fileSize = 0;
        try {
          const s = await stat(path);
          fileSize = s.size;
        }
        catch { /* fallback */ }
        return {
          type: "native" as const,
          name,
          ext: name.split(".").pop()?.toLowerCase() ?? "",
          path,
          fileSize,
        };
      }),
    );

    return this.runImportPipeline(items, onProgress, "Native Import");
  }

  async importFiles(
    files: File[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<ImportBatchResult> {
    const items: ImportItem[] = files.map(file => ({
      type: "web" as const,
      name: file.name,
      ext: file.name.split(".").pop()?.toLowerCase() ?? "",
      file,
      fileSize: file.size,
    }));

    return this.runImportPipeline(items, onProgress, "Web Import");
  }

  // ═══════════════════════════════════════════════════════
  // PUBLIC — WATCHED FOLDERS (external refs, no copy)
  // ═══════════════════════════════════════════════════════

  async syncFolder(
    folder: WatchedFolder,
    onProgress?: (current: number, total: number) => void,
    excludedPaths?: string[],
  ): Promise<SyncResult> {
    const result: SyncResult = {
      folderId: folder.id,
      added: 0,
      removed: 0,
      failed: 0,
      errors: [],
    };

    if (!hasNativeSupport(storageService)) return result;
    const nativeStorage = storageService as IFileStorageWithNativeSupport;

    // ── 1. Scan filesystem ──────────────────────────────
    const excludeSet = new Set(excludedPaths ?? []);
    const scanned = await scanFolder(folder.path, undefined, excludeSet);
    const scannedPaths = new Set(scanned.map(f => f.absolutePath));

    // ── 2. Load existing tracks for this folder ─────────
    let existingTracks = await db.tracks
      .where("storagePath")
      .startsWith(folder.path + "/")
      .toArray();

    if (excludedPaths && excludedPaths.length > 0) {
      existingTracks = existingTracks.filter(
        t => !excludedPaths.some(ep => t.storagePath.startsWith(ep + "/")),
      );
    }

    const existingPaths = new Set(existingTracks.map(t => t.storagePath));
    const newFiles = scanned.filter(f => !existingPaths.has(f.absolutePath));
    const removedTracks = existingTracks.filter(
      t => !scannedPaths.has(t.storagePath),
    );

    const totalWork = newFiles.length + removedTracks.length;
    let processed = 0;
    onProgress?.(0, totalWork);

    // ── 3. Fingerprint dedup ────────────────────────────
    const knownFingerprints = await this.loadKnownFingerprints();
    const filesToImport: Array<{ file: ScannedFile; fingerprint: string }> = [];

    for (const file of newFiles) {
      try {
        const fp = await computeFileFingerprint(file.absolutePath, file.size);
        if (knownFingerprints.has(fp)) {
          processed++;
          onProgress?.(processed, totalWork);
          continue;
        }
        knownFingerprints.add(fp);
        filesToImport.push({ file, fingerprint: fp });
      }
      catch {
        result.failed++;
        processed++;
        onProgress?.(processed, totalWork);
      }
    }

    // ── 4. Parse metadata ───────────────────────────────
    const allParsed: TrackToSave[] = [];

    const parseResults = await Promise.all(
      filesToImport.map(({ file, fingerprint }) =>
        this.limit(() =>
          this.parseExternalFile(file, fingerprint, nativeStorage),
        ),
      ),
    );

    for (const r of parseResults) {
      if (r !== null) allParsed.push(r);
      else result.failed++;
    }

    const failedParseCount = filesToImport.length - allParsed.length;
    processed += failedParseCount;
    onProgress?.(processed, totalWork);

    // ── 5. Resolve entities & save ──────────────────────
    if (allParsed.length > 0) {
      this.clearSessionCache();
      await this.batchPreResolveEntities(allParsed.map(p => p.meta));

      for (let i = 0; i < allParsed.length; i += DB_BATCH_SIZE) {
        const batch = allParsed.slice(i, i + DB_BATCH_SIZE);

        try {
          const saved = await this.saveBatchToDatabase(batch);
          result.added += saved.length;
        }
        catch (e) {
          result.failed += batch.length;
          result.errors.push({
            path: folder.path,
            message: `DB batch failed: ${String(e)}`,
          });
        }

        processed += batch.length;
        onProgress?.(processed, totalWork);
      }
    }

    // ── 6. Remove deleted tracks ────────────────────────
    if (removedTracks.length > 0) {
      await db.tracks.bulkDelete(removedTracks.map(t => t.id));
      result.removed = removedTracks.length;
      processed += removedTracks.length;
      onProgress?.(processed, totalWork);
    }

    return result;
  }

  async importSingleExternalFile(file: ScannedFile): Promise<boolean> {
    if (!hasNativeSupport(storageService)) return false;
    const nativeStorage = storageService as IFileStorageWithNativeSupport;

    const existsByPath = await db.tracks
      .where("storagePath")
      .equals(file.absolutePath)
      .count();
    if (existsByPath > 0) return false;

    const fp = await computeFileFingerprint(file.absolutePath, file.size);
    const existsByFp = await db.tracks
      .where("fingerprint")
      .equals(fp)
      .count();
    if (existsByFp > 0) return false;

    const trackToSave = await this.parseExternalFile(file, fp, nativeStorage);
    if (!trackToSave) return false;

    try {
      this.clearSessionCache();
      await this.batchPreResolveEntities([trackToSave.meta]);
      await this.saveBatchToDatabase([trackToSave]);
      return true;
    }
    catch {
      return false;
    }
  }

  async removeSingleFile(absolutePath: string): Promise<boolean> {
    const track = await db.tracks
      .where("storagePath")
      .equals(absolutePath)
      .first();
    if (!track) return false;
    await db.tracks.delete(track.id);
    return true;
  }

  dispose(): void {
    for (const worker of this.workerPool) worker.terminate();
    this.workerPool = [];
    this.pendingRequests.clear();
  }

  // ═══════════════════════════════════════════════════════
  // IMPORT PIPELINE (internal storage — copies files)
  // ═══════════════════════════════════════════════════════

  private async runImportPipeline(
    items: ImportItem[],
    onProgress: ((c: number, t: number) => void) | undefined,
    label: string,
  ): Promise<ImportBatchResult> {
    this.profiler.reset();
    this.clearSessionCache();

    const total = items.length;
    let processed = 0;
    let skipped = 0;
    const successful: ImportSuccess[] = [];
    const failed: Array<{ fileName: string; error: ImportError }> = [];

    onProgress?.(0, total);

    // ── 1. Validation ───────────────────────────────────
    this.profiler.start("1_validation");
    const validItems: ImportItem[] = [];

    for (const item of items) {
      if (!isValidImportItem(item.name, item.file?.type)) {
        failed.push({
          fileName: item.name,
          error: ImportError.unsupportedFormat(item.name, item.ext),
        });
        processed++;
        continue;
      }
      validItems.push(item);
    }
    onProgress?.(processed, total);
    this.profiler.end("1_validation");

    if (validItems.length === 0) {
      this.profiler.printReport(`${label} (No valid items)`);
      return { successful, failed, skipped, total, timings: this.profiler.getTimings() };
    }

    // ── 2. Fingerprint dedup ────────────────────────────
    this.profiler.start("2_fingerprint");
    const knownFingerprints = await this.loadKnownFingerprints();
    const dedupedItems: ImportItem[] = [];

    for (const item of validItems) {
      const fp = await this.computeItemFingerprint(item);

      if (fp && knownFingerprints.has(fp)) {
        skipped++;
        processed++;
        onProgress?.(processed, total);
        continue;
      }

      if (fp) {
        knownFingerprints.add(fp);
        item.fingerprint = fp;
      }
      dedupedItems.push(item);
    }
    this.profiler.end("2_fingerprint");

    if (dedupedItems.length === 0) {
      this.profiler.printReport(`${label} (All duplicates)`);
      return { successful, failed, skipped, total, timings: this.profiler.getTimings() };
    }

    // ── 3. Process (copy + parse in parallel) ───────────
    this.profiler.start("3_processFiles");
    const processResults = await Promise.all(
      dedupedItems.map(item =>
        this.limit(() => this.processInternalItem(item)),
      ),
    );
    this.profiler.end("3_processFiles");

    const readyToSave: TrackToSave[] = [];

    for (const r of processResults) {
      r.match(
        data => readyToSave.push(data),
        (error) => {
          failed.push({ fileName: error.fileName || "unknown", error });
          processed++;
          onProgress?.(processed, total);
        },
      );
    }

    if (readyToSave.length === 0) {
      this.profiler.printReport(`${label} (All failed)`);
      return { successful, failed, skipped, total, timings: this.profiler.getTimings() };
    }

    // ── 4. Resolve entities ─────────────────────────────
    this.profiler.start("4_entityResolution");
    await this.batchPreResolveEntities(readyToSave.map(i => i.meta));
    this.profiler.end("4_entityResolution");

    // ── 5. Save in DB batches ───────────────────────────
    for (let i = 0; i < readyToSave.length; i += DB_BATCH_SIZE) {
      const batch = readyToSave.slice(i, i + DB_BATCH_SIZE);

      this.profiler.start("5_database");
      const dbResult = await this.saveBatchToDatabaseSafe(batch);
      this.profiler.end("5_database");

      dbResult.match(
        (results) => {
          successful.push(...results);
          processed += batch.length;
          onProgress?.(processed, total);
        },
        (error) => {
          for (const item of batch) {
            failed.push({ fileName: item.fileName, error });
          }
          processed += batch.length;
          onProgress?.(processed, total);
        },
      );
    }

    this.profiler.printReport(label);

    return {
      successful,
      failed,
      skipped,
      total,
      timings: this.profiler.getTimings(),
    };
  }

  // ═══════════════════════════════════════════════════════
  // ITEM PROCESSING
  // ═══════════════════════════════════════════════════════

  /** Internal import: copy file to storage + parse metadata */
  private processInternalItem(
    item: ImportItem,
  ): ResultAsync<TrackToSave, ImportError> {
    const trackId = TrackId(crypto.randomUUID());
    const storagePath = `tracks/${trackId}.${item.ext}`;

    return ResultAsync.fromPromise(
      Promise.all([
        this.performCopy(item, storagePath),
        this.performParse(item),
      ]),
      (e: unknown) => {
        if (e instanceof ImportError) return e;
        return ImportError.parseFailed(item.name, e);
      },
    ).map(([_, rawMeta]) => {
      const fileMock = item.file
        || ({ name: item.name, webkitRelativePath: "" } as File);
      const meta = normalizeMetadata(fileMock, rawMeta);

      return {
        trackId,
        fileName: item.name,
        storagePath,
        fingerprint: item.fingerprint ?? "",
        source: TrackSource.LOCAL_INTERNAL,
        meta,
      };
    });
  }

  private async parseExternalFile(
    file: ScannedFile,
    fingerprint: string,
    nativeStorage: IFileStorageWithNativeSupport,
  ): Promise<TrackToSave | null> {
    try {
      const readResult = await nativeStorage.readBytes(
        file.absolutePath,
        HEAD_READ_SIZE,
      );
      if (readResult.isErr()) return null;

      const rawMeta = await this.parseMeta(file.name, readResult.value);
      const fileMock = {
        name: file.name,
        webkitRelativePath: "",
      } as File;
      const meta = normalizeMetadata(fileMock, rawMeta);

      return {
        trackId: TrackId(crypto.randomUUID()),
        fileName: file.name,
        storagePath: file.absolutePath,
        fingerprint,
        source: TrackSource.LOCAL_EXTERNAL,
        meta,
      };
    }
    catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════
  // FILE OPERATIONS (internal import only)
  // ═══════════════════════════════════════════════════════

  private async performCopy(
    item: ImportItem,
    targetPath: string,
  ): Promise<string> {
    let result: ResultAsync<string, StorageError>;

    if (item.type === "native" && hasNativeSupport(storageService) && item.path) {
      result = storageService.importFile(item.path, targetPath);
    }
    else if (item.type === "web" && item.file) {
      result = storageService.saveFile(targetPath, item.file);
    }
    else {
      throw ImportError.storageFailed(item.name, "Invalid item state");
    }

    const res = await result;
    if (res.isErr()) throw ImportError.storageFailed(item.name, res.error);
    return res.value;
  }

  private async performParse(item: ImportItem): Promise<BaseMetadata> {
    let data: Uint8Array;

    if (item.type === "native" && hasNativeSupport(storageService) && item.path) {
      const res = await storageService.readBytes(item.path, HEAD_READ_SIZE);
      if (res.isErr()) throw ImportError.readFailed(item.name, res.error);
      data = res.value;
    }
    else if (item.type === "web" && item.file) {
      try {
        const buffer = await item.file.arrayBuffer();
        data = new Uint8Array(buffer);
      }
      catch (e) {
        throw ImportError.readFailed(item.name, e);
      }
    }
    else {
      throw ImportError.nativeImportUnavailable(item.name);
    }

    return this.parseMeta(item.name, data);
  }

  // ═══════════════════════════════════════════════════════
  // WORKER POOL
  // ═══════════════════════════════════════════════════════

  private initWorkerPool(): void {
    for (let i = 0; i < WORKER_POOL_SIZE; i++) {
      const worker = new MetaWorker();
      worker.addEventListener("message", this.handleWorkerMessage.bind(this));
      this.workerPool.push(worker);
    }
  }

  private getNextWorker(): Worker {
    const worker = this.workerPool[this.workerIndex];
    this.workerIndex = (this.workerIndex + 1) % this.workerPool.length;
    return worker;
  }

  private handleWorkerMessage(e: MessageEvent<ParseResponse>): void {
    const pending = this.pendingRequests.get(e.data.fileId);
    if (!pending) return;

    clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(e.data.fileId);

    if (e.data.success) pending.resolve(e.data.meta);
    else pending.reject(new Error(e.data.error || "Worker error"));
  }

  private parseMeta(
    fileName: string,
    data: Uint8Array,
  ): Promise<BaseMetadata> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(ImportError.workerTimeout(fileName));
      }, WORKER_TIMEOUT);

      this.pendingRequests.set(id, { resolve, reject, timeoutId });
      this.getNextWorker().postMessage(
        { fileId: id, fileData: data, fileName },
        [data.buffer],
      );
    });
  }

  // ═══════════════════════════════════════════════════════
  // FINGERPRINT
  // ═══════════════════════════════════════════════════════

  private async loadKnownFingerprints(): Promise<Set<string>> {
    const tracks = await db.tracks
      .where("fingerprint")
      .above("")
      .toArray();

    const set = new Set<string>();
    for (const t of tracks) {
      if (t.fingerprint) set.add(t.fingerprint);
    }
    return set;
  }

  private async computeItemFingerprint(
    item: ImportItem,
  ): Promise<string | null> {
    try {
      if (item.type === "native" && item.path && hasNativeSupport(storageService)) {
        return await computeFileFingerprint(item.path, item.fileSize);
      }
      if (item.type === "web" && item.file) {
        return await computeFileFingerprintFromBlob(item.file);
      }
      return null;
    }
    catch {
      return null;
    }
  }

  // ═══════════════════════════════════════════════════════
  // ENTITY RESOLUTION
  // ═══════════════════════════════════════════════════════

  private clearSessionCache(): void {
    this.sessionCache.artists.clear();
    this.sessionCache.albums.clear();
  }

  private async batchPreResolveEntities(
    metas: NormalizedMeta[],
  ): Promise<void> {
    // ── Artists ──────────────────────────────────────────
    const artistNames = [...new Set(metas.map(m => m.artist))];

    const existingArtists = await db.artists
      .where("name")
      .anyOf(artistNames)
      .toArray();

    for (const artist of existingArtists) {
      this.sessionCache.artists.set(artist.name, artist.id);
    }

    for (const name of artistNames) {
      if (!this.sessionCache.artists.has(name)) {
        this.sessionCache.artists.set(name, ArtistId(crypto.randomUUID()));
      }
    }

    // ── Albums ──────────────────────────────────────────
    const uniqueArtistIds = [
      ...new Set(
        metas.map(m => this.sessionCache.artists.get(m.artist)!),
      ),
    ];

    const existingAlbums = await db.albums
      .where("artistId")
      .anyOf(uniqueArtistIds)
      .toArray();

    for (const album of existingAlbums) {
      const key = `${album.artistId}_${album.title}`;
      this.sessionCache.albums.set(key, { id: album.id, isNew: false });
    }

    for (const meta of metas) {
      const artistId = this.sessionCache.artists.get(meta.artist)!;
      const key = `${artistId}_${meta.album}`;

      if (!this.sessionCache.albums.has(key)) {
        this.sessionCache.albums.set(key, {
          id: AlbumId(crypto.randomUUID()),
          isNew: true,
        });
      }
    }
  }

  // ═══════════════════════════════════════════════════════
  // DATABASE
  // ═══════════════════════════════════════════════════════

  /** Wrapped version for the import pipeline (returns ResultAsync) */
  private saveBatchToDatabaseSafe(
    items: TrackToSave[],
  ): ResultAsync<ImportSuccess[], ImportError> {
    return ResultAsync.fromPromise(
      this.saveBatchToDatabase(items),
      error => ImportError.databaseFailed("batch", error),
    );
  }

  /** Core save — used by both import pipeline and watched-folder sync */
  private async saveBatchToDatabase(
    items: TrackToSave[],
  ): Promise<ImportSuccess[]> {
    const now = Date.now();

    return db.transaction(
      "rw",
      db.artists,
      db.albums,
      db.tracks,
      db.covers,
      async () => {
        const results: ImportSuccess[] = [];

        const artistsToAdd = new Map<
          ArtistId,
          { id: ArtistId; name: string }
        >();

        const albumsToAdd = new Map<
          AlbumId,
          {
            id: AlbumId;
            title: string;
            artistId: ArtistId;
            year?: number;
          }
        >();

        const coversToAdd = new Map<
          string,
          {
            id: string;
            ownerType: "album";
            ownerId: string;
            blob: Blob;
            mimeType: string;
            addedAt: number;
            updatedAt: number;
          }
        >();

        for (const item of items) {
          const artistId = this.sessionCache.artists.get(item.meta.artist)!;
          const albumData = this.sessionCache.albums.get(
            `${artistId}_${item.meta.album}`,
          )!;

          if (!artistsToAdd.has(artistId)) {
            const exists = await db.artists.get(artistId);
            if (!exists) {
              artistsToAdd.set(artistId, {
                id: artistId,
                name: item.meta.artist,
              });
            }
          }

          if (albumData.isNew && !albumsToAdd.has(albumData.id)) {
            const exists = await db.albums.get(albumData.id);
            if (!exists) {
              albumsToAdd.set(albumData.id, {
                id: albumData.id,
                title: item.meta.album,
                artistId,
                year: item.meta.year,
              });
            }
          }

          if (albumData.isNew && item.meta.pictureBlob) {
            const coverKey = `album_${albumData.id}`;

            if (!coversToAdd.has(coverKey)) {
              const existingCover = await db.covers
                .where("[ownerType+ownerId]")
                .equals(["album", albumData.id])
                .first();

              if (!existingCover) {
                coversToAdd.set(coverKey, {
                  id: crypto.randomUUID(),
                  ownerType: "album",
                  ownerId: albumData.id,
                  blob: item.meta.pictureBlob,
                  mimeType: item.meta.pictureBlob.type || "image/jpeg",
                  addedAt: now,
                  updatedAt: now,
                });
              }
            }
          }

          await db.tracks.add({
            id: item.trackId,
            title: item.meta.title,
            artistId,
            albumId: albumData.id,
            tagIds: [],
            source: item.source,
            state: TrackState.READY,
            storagePath: item.storagePath,
            duration: item.meta.duration,
            format: item.meta.format,
            trackNo: item.meta.trackNo,
            diskNo: item.meta.diskNo,
            isLiked: false,
            playCount: 0,
            searchKey: item.meta.searchKey,
            addedAt: now,
            fingerprint: item.fingerprint,
          });

          results.push({
            trackId: item.trackId,
            fileName: item.fileName,
            title: item.meta.title,
            artist: item.meta.artist,
            album: item.meta.album,
          });
        }

        if (artistsToAdd.size > 0) {
          await db.artists.bulkAdd(
            [...artistsToAdd.values()].map(a => ({
              ...a,
              addedAt: now,
              updatedAt: now,
            })),
          );
        }

        if (albumsToAdd.size > 0) {
          await db.albums.bulkAdd(
            [...albumsToAdd.values()].map(a => ({
              ...a,
              addedAt: now,
              updatedAt: now,
            })),
          );
        }

        if (coversToAdd.size > 0) {
          await db.covers.bulkAdd([...coversToAdd.values()]);
        }

        return results;
      },
    );
  }

  // ═══════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════

  private createEmptyFailResult(
    paths: string[],
    error: string,
  ): ImportBatchResult {
    return {
      successful: [],
      failed: paths.map(p => ({
        fileName: p.split(/[\\/]/).pop() ?? "unknown",
        error: new ImportError(
          ImportErrorCode.NATIVE_IMPORT_UNAVAILABLE,
          error,
        ),
      })),
      skipped: 0,
      total: paths.length,
    };
  }
}

// ═══════════════════════════════════════════════════════
// SINGLETON + BACKWARD-COMPATIBLE ALIASES
// ═══════════════════════════════════════════════════════

export const musicLibraryEngine = new MusicLibraryEngine();
