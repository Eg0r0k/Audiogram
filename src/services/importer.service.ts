import pLimit from "p-limit";
import { ResultAsync } from "neverthrow";
import { open } from "@tauri-apps/plugin-dialog";
import { stat } from "@tauri-apps/plugin-fs";

import MetaWorker from "@/workers/meta.worker?worker";
import { db } from "@/db/index";
import type { BaseMetadata, ParseResponse } from "@/workers/types";
import { normalizeMetadata } from "@/lib/metadata";
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
const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024;
const MAX_METADATA_READ = 2 * 1024 * 1024;
const WORKER_TIMEOUT = 20_000;
const WORKER_POOL_SIZE = 8;
const PROCESS_CONCURRENCY = 16;
const DB_BATCH_SIZE = 50;
const PIPELINE_BATCH_SIZE = 60;
const FINGERPRINT_CONCURRENCY = 16;

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
  storagePath?: string;
  fingerprint?: string;
  source?: TrackSource;
  meta?: BaseMetadata;
}

export interface ImportBatchResult {
  successful: ImportSuccess[];
  failed: Array<{ fileName: string; error: ImportError }>;
  skipped: number;
  total: number;
  timings?: Record<string, number>;
}

export interface ImportControl {
  waitIfPaused?: () => Promise<void>;
  isCancelled?: () => boolean;
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
  meta: BaseMetadata;
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
  private fpLimit = pLimit(FINGERPRINT_CONCURRENCY);
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
    control?: ImportControl,
  ): Promise<ImportBatchResult> {
    if (!hasNativeSupport(storageService)) {
      return this.createEmptyFailResult(paths, "Native support missing");
    }

    this.profiler.start("0_warmup");
    await storageService.warmup(["tracks", "lyrics"]);
    this.profiler.end("0_warmup");

    const items: ImportItem[] = paths.map((path) => {
      const name = path.split(/[\\/]/).pop() ?? "unknown";

      return {
        type: "native" as const,
        name,
        ext: name.split(".").pop()?.toLowerCase() ?? "",
        path,
        fileSize: 0,
      };
    });

    return this.runImportPipeline(items, onProgress, "Native Import", control);
  }

  async importFiles(
    files: File[],
    onProgress?: (current: number, total: number) => void,
    control?: ImportControl,
  ): Promise<ImportBatchResult> {
    const items: ImportItem[] = files.map(file => ({
      type: "web" as const,
      name: file.name,
      ext: file.name.split(".").pop()?.toLowerCase() ?? "",
      file,
      fileSize: file.size,
    }));

    return this.runImportPipeline(items, onProgress, "Web Import", control);
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

  async cleanupOrphanedFiles(): Promise<number> {
    if (!hasNativeSupport(storageService)) return 0;

    const nativeStorage = storageService as IFileStorageWithNativeSupport;

    const listResult = await nativeStorage.listFiles("tracks");
    if (listResult.isErr()) return 0;

    const storedPaths = new Set(listResult.value);
    const dbTracks = await db.tracks.toArray();
    const dbPaths = new Set(dbTracks.map(t => t.storagePath));

    let removed = 0;
    for (const storedPath of storedPaths) {
      const fullPath = storedPath.startsWith("tracks/") ? storedPath : `tracks/${storedPath}`;
      if (!dbPaths.has(fullPath)) {
        await nativeStorage.deleteFile(fullPath);
        removed++;
      }
    }

    return removed;
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
    control?: ImportControl,
  ): Promise<ImportBatchResult> {
    this.profiler.reset();
    this.clearSessionCache();

    const total = items.length;
    let processed = 0;
    let skipped = 0;
    const successful: ImportSuccess[] = [];
    const failed: Array<{ fileName: string; error: ImportError }> = [];

    onProgress?.(0, total);

    await control?.waitIfPaused?.();
    if (control?.isCancelled?.()) {
      return {
        successful,
        failed,
        skipped,
        total,
        timings: this.profiler.getTimings(),
      };
    }

    this.profiler.start("0_loadKnownFingerprints");
    const knownFingerprints = await this.loadKnownFingerprints();
    this.profiler.end("0_loadKnownFingerprints");

    await control?.waitIfPaused?.();
    if (control?.isCancelled?.()) {
      return {
        successful,
        failed,
        skipped,
        total,
        timings: this.profiler.getTimings(),
      };
    }

    this.profiler.start("1_splitBatches");
    const batches: ImportItem[][] = [];
    for (let i = 0; i < items.length; i += PIPELINE_BATCH_SIZE) {
      batches.push(items.slice(i, i + PIPELINE_BATCH_SIZE));
    }
    this.profiler.end("1_splitBatches");

    this.profiler.start("2_processBatches");
    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      await control?.waitIfPaused?.();
      if (control?.isCancelled?.()) break;

      const batch = batches[batchIdx];
      this.profiler.start(`2_batch_${batchIdx}`);

      const batchResult = await this.processBatchHorizontal(
        batch,
        knownFingerprints,
        (p) => {
          onProgress?.(processed + p, total);
        },
        control,
      );

      skipped += batchResult.skipped;
      failed.push(...batchResult.failed);
      processed += batchResult.processed;

      if (batchResult.tracksToSave.length > 0) {
        await control?.waitIfPaused?.();
        if (control?.isCancelled?.()) break;

        this.profiler.start(`2_batch_${batchIdx}_entityResolution`);
        await this.batchPreResolveEntities(batchResult.tracksToSave.map(item => item.meta));
        this.profiler.end(`2_batch_${batchIdx}_entityResolution`);

        this.profiler.start(`2_batch_${batchIdx}_database`);
        for (let i = 0; i < batchResult.tracksToSave.length; i += DB_BATCH_SIZE) {
          await control?.waitIfPaused?.();
          if (control?.isCancelled?.()) break;

          const dbBatch = batchResult.tracksToSave.slice(i, i + DB_BATCH_SIZE);
          const dbResult = await this.saveBatchToDatabaseSafe(dbBatch);
          dbResult.match(
            (saved) => {
              successful.push(...saved);
            },
            (error) => {
              for (const item of dbBatch) {
                failed.push({ fileName: item.fileName, error });
              }
            },
          );
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        this.profiler.end(`2_batch_${batchIdx}_database`);
      }

      this.profiler.end(`2_batch_${batchIdx}`);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    this.profiler.end("2_processBatches");

    this.profiler.printReport(label);

    return {
      successful,
      failed,
      skipped,
      total,
      timings: this.profiler.getTimings(),
    };
  }

  private async processBatchHorizontal(
    items: ImportItem[],
    knownFingerprints: Set<string>,
    onItemProgress: (completed: number) => void,
    control?: ImportControl,
  ): Promise<{
    tracksToSave: TrackToSave[];
    failed: Array<{ fileName: string; error: ImportError }>;
    skipped: number;
    processed: number;
  }> {
    const tracksToSave: TrackToSave[] = [];
    const failed: Array<{ fileName: string; error: ImportError }> = [];
    let skipped = 0;
    let processed = 0;

    this.profiler.start("batch_validation");
    const validated: ImportItem[] = [];
    for (const item of items) {
      await control?.waitIfPaused?.();
      if (control?.isCancelled?.()) break;

      if (!isValidImportItem(item.name, item.file?.type)) {
        failed.push({
          fileName: item.name,
          error: ImportError.unsupportedFormat(item.name, item.ext),
        });
        processed++;
        onItemProgress(processed);
        continue;
      }
      validated.push(item);
    }
    this.profiler.end("batch_validation");

    if (validated.length === 0) {
      return { tracksToSave, failed, skipped, processed };
    }

    await control?.waitIfPaused?.();
    if (control?.isCancelled?.()) {
      return { tracksToSave, failed, skipped, processed };
    }

    this.profiler.start("batch_fingerprint");
    const fingerprinted: ImportItem[] = [];
    const fpResults = await Promise.all(
      validated.map(item =>
        this.fpLimit(async () => {
          const fp = await this.computeItemFingerprint(item);
          return { item, fp };
        }),
      ),
    );

    for (const { item, fp } of fpResults) {
      await control?.waitIfPaused?.();
      if (control?.isCancelled?.()) break;

      if (fp && knownFingerprints.has(fp)) {
        skipped++;
        processed++;
        onItemProgress(processed);
        continue;
      }

      if (fp) {
        knownFingerprints.add(fp);
        item.fingerprint = fp;
      }
      fingerprinted.push(item);
    }
    this.profiler.end("batch_fingerprint");

    // Deduplicate within batch (in case two identical files passed initial check)
    const batchDedup = new Map<string, ImportItem>();
    for (const item of fingerprinted) {
      if (item.fingerprint) {
        if (!batchDedup.has(item.fingerprint)) {
          batchDedup.set(item.fingerprint, item);
        }
        else {
          skipped++;
          processed++;
        }
      }
      else {
        batchDedup.set(item.name, item);
      }
    }
    const dedupedItems = Array.from(batchDedup.values());

    if (dedupedItems.length === 0) {
      return { tracksToSave, failed, skipped, processed };
    }

    await control?.waitIfPaused?.();
    if (control?.isCancelled?.()) {
      return { tracksToSave, failed, skipped, processed };
    }

    this.profiler.start("batch_process");
    const processResults = await Promise.all(
      dedupedItems.map(item =>
        this.limit(async () => {
          await control?.waitIfPaused?.();
          if (control?.isCancelled?.()) return null;
          return this.processInternalItem(item, control);
        }),
      ),
    );
    this.profiler.end("batch_process");

    for (const r of processResults) {
      await control?.waitIfPaused?.();
      if (control?.isCancelled?.()) break;
      if (r === null) continue;

      r.match(
        (data) => {
          tracksToSave.push(data);
        },
        (error) => {
          failed.push({ fileName: error.fileName || "unknown", error });
        },
      );
      processed++;
      onItemProgress(processed);
    }

    return { tracksToSave, failed, skipped, processed };
  }

  // ═══════════════════════════════════════════════════════
  // ITEM PROCESSING
  // ═══════════════════════════════════════════════════════

  /** Internal import: parse metadata first, then save to DB, then copy file */
  private processInternalItem(
    item: ImportItem,
    control?: ImportControl,
  ): ResultAsync<TrackToSave, ImportError> {
    const trackId = TrackId(crypto.randomUUID());
    const storagePath = `tracks/${trackId}.${item.ext}`;

    this.profiler.start("item_parse");

    return ResultAsync.fromPromise(
      this.performParse(item),
      (e: unknown) => {
        this.profiler.end("item_parse");
        if (e instanceof ImportError) return e;
        return ImportError.parseFailed(item.name, e);
      },
    ).andThen((meta) => {
      this.profiler.end("item_parse");
      this.profiler.start("item_copy");

      const fileMock = item.file
        || ({ name: item.name, webkitRelativePath: "" } as File);
      const normalizedMeta = normalizeMetadata(fileMock, meta);

      const fingerprint = item.fingerprint ?? "";

      return ResultAsync.fromPromise(
        (async () => {
          await control?.waitIfPaused?.();
          if (control?.isCancelled?.()) {
            throw ImportError.readFailed(item.name, "Import cancelled");
          }
          return this.performCopy(item, storagePath);
        })(),
        (e: unknown) => {
          this.profiler.end("item_copy");
          if (e instanceof ImportError) return e;
          return ImportError.storageFailed(item.name, e);
        },
      ).map(() => {
        this.profiler.end("item_copy");
        return {
          trackId,
          fileName: item.name,
          storagePath,
          fingerprint,
          source: TrackSource.LOCAL_INTERNAL,
          meta: normalizedMeta,
        };
      });
    });
  }

  private async parseExternalFile(
    file: ScannedFile,
    fingerprint: string,
    nativeStorage: IFileStorageWithNativeSupport,
  ): Promise<TrackToSave | null> {
    try {
      const readSize = file.size < LARGE_FILE_THRESHOLD
        ? Math.min(file.size, MAX_METADATA_READ)
        : HEAD_READ_SIZE;

      const readResult = await nativeStorage.readBytes(
        file.absolutePath,
        readSize,
      );
      if (readResult.isErr()) return null;

      const rawMeta = await this.parseMeta(file.name, readResult.value);
      const fileMock = {
        name: file.name,
        webkitRelativePath: "",
      } as File;
      const meta = normalizeMetadata(fileMock, rawMeta);

      if (!meta.duration && file.size < LARGE_FILE_THRESHOLD && file.size > readSize) {
        const fullReadResult = await nativeStorage.readBytes(
          file.absolutePath,
          Math.min(file.size, MAX_METADATA_READ),
        );
        if (fullReadResult.isOk()) {
          const fullMeta = await this.parseMeta(file.name, fullReadResult.value);
          const normalizedFullMeta = normalizeMetadata(fileMock, fullMeta);
          if (normalizedFullMeta.duration > 0) {
            return {
              trackId: TrackId(crypto.randomUUID()),
              fileName: file.name,
              storagePath: file.absolutePath,
              fingerprint,
              source: TrackSource.LOCAL_EXTERNAL,
              meta: normalizedFullMeta,
            };
          }
        }
      }

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

    if (e.data.success) {
      pending.resolve(e.data.meta);
    }
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
        let fileSize = item.fileSize;

        if (fileSize <= 0) {
          try {
            const fileStat = await stat(item.path);
            fileSize = fileStat.size;
            item.fileSize = fileSize;
          }
          catch {
            fileSize = 0;
          }
        }

        return await computeFileFingerprint(item.path, fileSize);
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
    metas: BaseMetadata[],
  ): Promise<void> {
    // Only process artists that actually exist in metadata
    const allArtistNames = metas
      .flatMap(m => m.artists)
      .filter(a => a && a.trim() !== "");

    const uniqueArtistNames = [...new Set(allArtistNames)];

    // Only fetch/create artists if there are actual artist names
    if (uniqueArtistNames.length > 0) {
      const existingArtists = await db.artists
        .where("name")
        .anyOf(uniqueArtistNames)
        .toArray();

      for (const artist of existingArtists) {
        this.sessionCache.artists.set(artist.name, artist.id);
      }

      for (const name of uniqueArtistNames) {
        if (!this.sessionCache.artists.has(name)) {
          this.sessionCache.artists.set(name, ArtistId(crypto.randomUUID()));
        }
      }
    }

    const uniqueArtistIds = [
      ...new Set(
        metas.flatMap(m => m.artists.map(artistName => this.sessionCache.artists.get(artistName)).filter((id): id is ArtistId => !!id)),
      ),
    ];

    // Only process albums if there are actual artist IDs
    if (uniqueArtistIds.length > 0) {
      const existingAlbums = await db.albums
        .where("artistId")
        .anyOf(uniqueArtistIds)
        .toArray();

      for (const album of existingAlbums) {
        const key = `${album.artistId}_${album.title}`;
        this.sessionCache.albums.set(key, { id: album.id, isNew: false });
      }

      // Only create albums if there's an actual album name
      for (const meta of metas) {
        if (!meta.album || meta.album.trim() === "" || meta.album === "Unknown Album") {
          continue;
        }

        const firstArtistId = this.sessionCache.artists.get(meta.artists[0]);
        if (!firstArtistId) continue;

        const key = `${firstArtistId}_${meta.album}`;

        if (!this.sessionCache.albums.has(key)) {
          this.sessionCache.albums.set(key, {
            id: AlbumId(crypto.randomUUID()),
            isNew: true,
          });
        }
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
        const tracksToAdd = [];

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

        const artistIds = Array.from(new Set(
          items.flatMap(item => item.meta.artists.map(artistName => this.sessionCache.artists.get(artistName)).filter((id): id is ArtistId => !!id)),
        ));
        const existingArtists = await db.artists.bulkGet(artistIds);
        const existingArtistIds = new Set(
          existingArtists
            .filter((artist): artist is NonNullable<typeof artist> => !!artist)
            .map(artist => artist.id),
        );

        const albumIds = Array.from(new Set(
          items
            .map((item) => {
              const firstArtistId = item.meta.artists[0] ? this.sessionCache.artists.get(item.meta.artists[0]) : null;
              if (!firstArtistId) return null;
              return this.sessionCache.albums.get(`${firstArtistId}_${item.meta.album}`)?.id ?? null;
            })
            .filter((id): id is AlbumId => !!id),
        ));
        const existingAlbums = await db.albums.bulkGet(albumIds);
        const existingAlbumIds = new Set(
          existingAlbums
            .filter((album): album is NonNullable<typeof album> => !!album)
            .map(album => album.id),
        );

        const newAlbumIds = Array.from(new Set(
          items
            .map((item) => {
              const firstArtistId = item.meta.artists[0] ? this.sessionCache.artists.get(item.meta.artists[0]) : null;
              if (!firstArtistId) return null;
              const album = this.sessionCache.albums.get(`${firstArtistId}_${item.meta.album}`);
              return album?.isNew ? album.id : null;
            })
            .filter((id): id is AlbumId => !!id),
        ));
        const existingCovers = newAlbumIds.length > 0
          ? await db.covers
              .where("[ownerType+ownerId]")
              .anyOf(newAlbumIds.map(id => ["album", id] as const))
              .toArray()
          : [];
        const existingCoverOwnerIds = new Set(existingCovers.map(cover => cover.ownerId));

        for (const item of items) {
          // Get artist IDs only if there are actual artist names
          const artistIds = item.meta.artists
            .filter(a => a && a.trim() !== "")
            .map(name => this.sessionCache.artists.get(name))
            .filter((id): id is ArtistId => !!id);
          const firstArtistId = artistIds[0] ?? null;

          // Only get album if there's an actual album name
          const hasAlbum = item.meta.album && item.meta.album.trim() !== "" && item.meta.album !== "Unknown Album";
          let albumId: AlbumId = AlbumId("");

          if (hasAlbum && firstArtistId) {
            const albumData = this.sessionCache.albums.get(`${firstArtistId}_${item.meta.album}`);
            if (albumData) {
              albumId = albumData.id;

              if (albumData.isNew && !albumsToAdd.has(albumData.id)) {
                if (!existingAlbumIds.has(albumData.id)) {
                  albumsToAdd.set(albumData.id, {
                    id: albumData.id,
                    title: item.meta.album,
                    artistId: firstArtistId,
                    year: item.meta.year,
                  });
                }
              }
            }
          }

          // Only add artists if there are actual artist names
          if (artistIds.length > 0) {
            for (const artistId of artistIds) {
              if (!artistsToAdd.has(artistId)) {
                if (!existingArtistIds.has(artistId)) {
                  const artistName = item.meta.artists.find(a => this.sessionCache.artists.get(a) === artistId);
                  if (artistName) {
                    artistsToAdd.set(artistId, {
                      id: artistId,
                      name: artistName,
                    });
                  }
                }
              }
            }
          }

          // Skip if no artist at all
          if (!firstArtistId) {
            continue;
          }

          // Add cover if album has one
          if (albumId && hasAlbum) {
            const firstArtistIdForAlbum = firstArtistId!;
            const albumData = this.sessionCache.albums.get(`${firstArtistIdForAlbum}_${item.meta.album}`);
            if (albumData?.isNew && item.meta.pictureBlob) {
              const coverKey = `album_${albumData.id}`;
              if (!coversToAdd.has(coverKey) && !existingCoverOwnerIds.has(albumData.id)) {
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

          tracksToAdd.push({
            id: item.trackId,
            title: item.meta.title,
            artistName: item.meta.artists.join(", "),
            albumTitle: item.meta.album || "",
            artistIds,
            albumId,
            tagIds: [],
            source: item.source,
            state: TrackState.READY,
            storagePath: item.storagePath,
            duration: item.meta.duration,
            format: item.meta.format,
            trackNo: item.meta.trackNo,
            diskNo: item.meta.diskNo,
            playCount: 0,
            addedAt: now,
            fingerprint: item.fingerprint,
            integratedLufs: item.meta.integratedLufs,
            truePeakDbtp: item.meta.truePeakDbtp,
            replayGainDb: item.meta.replayGainDb,
            replayPeak: item.meta.replayPeak,
          });

          results.push({
            trackId: item.trackId,
            fileName: item.fileName,
            title: item.meta.title,
            artist: item.meta.artists.join(", "),
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

        if (tracksToAdd.length > 0) {
          await db.tracks.bulkAdd(tracksToAdd);
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
