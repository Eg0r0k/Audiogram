import pLimit from "p-limit";
import { ResultAsync } from "neverthrow";
import { open } from "@tauri-apps/plugin-dialog";

import MetaWorker from "../workers/meta.worker?worker";
import { db } from "@/db/index";
import type { BaseMetadata, ParseResponse } from "@/workers/types";
import { normalizeMetadata, type NormalizedMeta } from "@/lib/metadata";
import { AlbumId, ArtistId, TrackId } from "@/types/ids";
import { storageService } from "@/db/storage";
import { hasNativeSupport } from "@/db/storage/IFileStorage";
import { TrackSource, TrackState } from "@/db/entities";
import { StorageError } from "@/db/errors/storage.errors";
import { isValidImportItem } from "@/lib/environment/mimeSupport";
import { TimeProfiler } from "@/lib/profiler";

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
  total: number;
  timings?: Record<string, number>;
}

interface ImportItem {
  type: "native" | "web";
  id: string;
  name: string;
  ext: string;
  file?: File;
  path?: string;
}

interface ProcessedItem {
  trackId: TrackId;
  fileName: string;
  storagePath: string;
  meta: NormalizedMeta;
  item: ImportItem;
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
// LIBRARY IMPORTER
// ═══════════════════════════════════════════════════════

export class LibraryImporter {
  private workerPool: Worker[] = [];
  private workerIndex = 0;

  // Strict typing for pending requests
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

  get isNativeImportAvailable(): boolean {
    return hasNativeSupport(storageService);
  }

  async pickFiles(): Promise<string[] | null> {
    const result = await open({
      multiple: true,
      title: "Выберите аудио файлы",
      filters: [
        {
          name: "Audio",
          extensions: ["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus", "wma", "alac"],
        },
      ],
    });

    if (!result) return null;
    return Array.isArray(result) ? result : [result];
  }

  async importFromPaths(
    paths: string[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<ImportBatchResult> {
    if (!hasNativeSupport(storageService)) {
      return this.createFailResult(paths, "Native support missing");
    }

    this.profiler.start("0_warmup");
    await storageService.warmup(["tracks", "covers"]);
    this.profiler.end("0_warmup");

    const items: ImportItem[] = paths.map((path) => {
      const name = path.split(/[\\/]/).pop() ?? "unknown";
      return {
        type: "native",
        id: crypto.randomUUID(),
        name,
        ext: name.split(".").pop()?.toLowerCase() ?? "",
        path,
      };
    });

    return this.runPipeline(items, onProgress, "Native Import");
  }

  async importFiles(
    files: File[],
    onProgress?: (current: number, total: number) => void,
  ): Promise<ImportBatchResult> {
    const items: ImportItem[] = files.map(file => ({
      type: "web",
      id: crypto.randomUUID(),
      name: file.name,
      ext: file.name.split(".").pop()?.toLowerCase() ?? "",
      file,
    }));

    return this.runPipeline(items, onProgress, "Web Import");
  }

  dispose(): void {
    for (const worker of this.workerPool) {
      worker.terminate();
    }
    this.workerPool = [];
    this.pendingRequests.clear();
  }

  // ═══════════════════════════════════════════════════════
  // PIPELINE
  // ═══════════════════════════════════════════════════════

  private async runPipeline(
    items: ImportItem[],
    onProgress: ((c: number, t: number) => void) | undefined,
    label: string,
  ): Promise<ImportBatchResult> {
    this.profiler.reset();
    this.clearSessionCache();

    const total = items.length;
    let processed = 0;
    const successful: ImportSuccess[] = [];
    const failed: Array<{ fileName: string; error: ImportError }> = [];

    onProgress?.(0, total);

    // 1. VALIDATION
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
      return { successful, failed, total, timings: this.profiler.getTimings() };
    }

    // 2. PROCESSING
    this.profiler.start("2_processFiles");

    const processResults = await Promise.all(
      validItems.map(item => this.limit(() => this.processItem(item))),
    );

    this.profiler.end("2_processFiles");

    const readyToSave: ProcessedItem[] = [];

    for (const result of processResults) {
      result.match(
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
      return { successful, failed, total, timings: this.profiler.getTimings() };
    }

    // 3. RESOLVE ENTITIES
    this.profiler.start("3_entityResolution");
    await this.batchPreResolveEntities(readyToSave.map(i => i.meta));
    this.profiler.end("3_entityResolution");

    // 4. SAVE TO DB
    for (let i = 0; i < readyToSave.length; i += DB_BATCH_SIZE) {
      const batch = readyToSave.slice(i, i + DB_BATCH_SIZE);

      this.profiler.start("4_coverSaving");
      const itemsWithCovers = await Promise.all(
        batch.map(async (pItem) => {
          const coverPath = await this.saveCoverIfNeeded(pItem.meta);
          return { ...pItem, coverPath };
        }),
      );
      this.profiler.end("4_coverSaving");

      this.profiler.start("5_database");
      const dbResult = await this.batchSaveToDatabase(itemsWithCovers);
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
      total,
      timings: this.profiler.getTimings(),
    };
  }

  // ═══════════════════════════════════════════════════════
  // ITEM PROCESSING
  // ═══════════════════════════════════════════════════════

  private processItem(item: ImportItem): ResultAsync<ProcessedItem, ImportError> {
    const trackId = TrackId(crypto.randomUUID());
    const storagePath = `tracks/${trackId}.${item.ext}`;

    const copyPromise = this.performCopy(item, storagePath);
    const parsePromise = this.performParse(item);

    return ResultAsync.fromPromise(
      Promise.all([copyPromise, parsePromise]),
      (e: unknown) => {
        if (e instanceof ImportError) return e;
        // Оборачиваем неизвестную ошибку
        return ImportError.parseFailed(item.name, e);
      },
    ).map(([_, rawMeta]) => {
      const fileMock = item.file || ({ name: item.name, webkitRelativePath: "" } as File);
      const meta = normalizeMetadata(fileMock, rawMeta);

      return {
        trackId,
        fileName: item.name,
        storagePath,
        meta,
        item,
      };
    });
  }

  private async performCopy(item: ImportItem, targetPath: string): Promise<string> {
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
    if (res.isErr()) {
      throw ImportError.storageFailed(item.name, res.error);
    }
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

    const parseRes = await this.parseMetaInWorker(item.name, data);

    if (parseRes.isErr()) {
      throw parseRes.error;
    }

    return parseRes.value;
  }

  // ═══════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════

  private createFailResult(paths: string[], error: string): ImportBatchResult {
    return {
      successful: [],
      failed: paths.map(p => ({
        fileName: p.split(/[\\/]/).pop() ?? "unknown",
        error: new ImportError(ImportErrorCode.NATIVE_IMPORT_UNAVAILABLE, error),
      })),
      total: paths.length,
    };
  }

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
    else {
      pending.reject(new Error(e.data.error || "Worker error"));
    }
  }

  private parseMetaInWorker(
    fileName: string,
    fileData: Uint8Array,
  ): ResultAsync<BaseMetadata, ImportError> {
    return ResultAsync.fromPromise(
      new Promise<BaseMetadata>((resolve, reject) => {
        const id = crypto.randomUUID();
        const timeoutId = setTimeout(() => {
          this.pendingRequests.delete(id);
          reject(ImportError.workerTimeout(fileName));
        }, WORKER_TIMEOUT);

        this.pendingRequests.set(id, { resolve, reject, timeoutId });

        const worker = this.getNextWorker();
        worker.postMessage(
          { fileId: id, fileData, fileName },
          [fileData.buffer],
        );
      }),
      error => ImportError.parseFailed(fileName, error),
    );
  }

  private clearSessionCache(): void {
    this.sessionCache.artists.clear();
    this.sessionCache.albums.clear();
  }

  // ═══════════════════════════════════════════════════════
  // ENTITY RESOLUTION & DB
  // ═══════════════════════════════════════════════════════

  private async batchPreResolveEntities(metas: NormalizedMeta[]): Promise<void> {
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

    const uniqueArtistIds = [
      ...new Set(metas.map(m => this.sessionCache.artists.get(m.artist)!)),
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

  private async saveCoverIfNeeded(meta: NormalizedMeta): Promise<string | undefined> {
    const artistId = this.sessionCache.artists.get(meta.artist);
    if (!artistId) return undefined;

    const albumData = this.sessionCache.albums.get(`${artistId}_${meta.album}`);
    if (!albumData?.isNew || !meta.pictureBlob) return undefined;

    const coverPath = `covers/art_${albumData.id}`;
    const result = await storageService.saveFile(coverPath, meta.pictureBlob);
    return result.isOk() ? coverPath : undefined;
  }

  private batchSaveToDatabase(
    items: Array<{
      trackId: TrackId;
      fileName: string;
      storagePath: string;
      meta: NormalizedMeta;
      coverPath?: string;
    }>,
  ): ResultAsync<ImportSuccess[], ImportError> {
    return ResultAsync.fromPromise(
      db.transaction("rw", db.artists, db.albums, db.tracks, async () => {
        const now = Date.now();
        const results: ImportSuccess[] = [];

        const artistsToAdd = new Map<ArtistId, { id: ArtistId; name: string }>();
        const albumsToAdd = new Map<
          AlbumId,
          { id: AlbumId; title: string; artistId: ArtistId; year?: number; coverPath?: string }
        >();

        for (const { trackId, fileName, storagePath, meta, coverPath } of items) {
          const artistId = this.sessionCache.artists.get(meta.artist)!;
          const albumData = this.sessionCache.albums.get(`${artistId}_${meta.album}`)!;

          if (!artistsToAdd.has(artistId)) {
            const exists = await db.artists.get(artistId);
            if (!exists) {
              artistsToAdd.set(artistId, { id: artistId, name: meta.artist });
            }
          }

          if (albumData.isNew && !albumsToAdd.has(albumData.id)) {
            const exists = await db.albums.get(albumData.id);
            if (!exists) {
              albumsToAdd.set(albumData.id, {
                id: albumData.id,
                title: meta.album,
                artistId,
                year: meta.year,
                coverPath,
              });
            }
          }

          await db.tracks.add({
            id: trackId,
            title: meta.title,
            artistId,
            albumId: albumData.id,
            tagIds: [],
            source: TrackSource.LOCAL_INTERNAL,
            state: TrackState.READY,
            storagePath,
            duration: meta.duration,
            format: meta.format,
            trackNo: meta.trackNo,
            diskNo: meta.diskNo,
            isLiked: false,
            playCount: 0,
            searchKey: meta.searchKey,
            addedAt: now,
          });

          results.push({
            trackId,
            fileName,
            title: meta.title,
            artist: meta.artist,
            album: meta.album,
          });
        }

        if (artistsToAdd.size > 0) {
          await db.artists.bulkAdd(
            [...artistsToAdd.values()].map(a => ({ ...a, addedAt: now, updatedAt: now })),
          );
        }
        if (albumsToAdd.size > 0) {
          await db.albums.bulkAdd(
            [...albumsToAdd.values()].map(a => ({ ...a, addedAt: now, updatedAt: now })),
          );
        }

        return results;
      }),
      error => ImportError.databaseFailed("batch", error),
    );
  }
}

export const libraryImporter = new LibraryImporter();
