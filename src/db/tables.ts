import Dexie, { type Table } from "dexie";
import type { AppDatabase } from "@/db";

export const TABLE_NAMES = [
  "tracks", "artists", "albums", "tags", "playlists", "folders", "listenEvents", "covers",
  "radioStations", "audioFeatures", "trackChapters", "offlineCopies", "downloadJobs",
  "recommenderModels", "queueSnapshot", "counters",
] as const satisfies readonly (keyof AppDatabase)[];

export type TableName = (typeof TABLE_NAMES)[number];
export type TableMap = Pick<AppDatabase, TableName>;

// Dexie and Transaction both resolve a table by name; a repository takes its tables from whichever it was built over.
export interface TableSource { table: (name: string) => Table }

export const tableOf = <N extends TableName>(source: TableSource, name: N): TableMap[N] =>
  source.table(name) as TableMap[N];

// A repository bound to the database opens its own transaction; one bound to a transaction is already inside it.
export const withinTransaction = <T>(source: TableSource, tables: readonly TableName[], work: () => Promise<T>): Promise<T> =>
  source instanceof Dexie ? source.transaction("rw", [...tables], work) : work();
