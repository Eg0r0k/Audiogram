import type { Transaction } from "dexie";
import { db } from ".";
import { AlbumRepository } from "./repositories/album.repository";
import { ArtistRepository } from "./repositories/artist.repository";
import { guarded } from "./repositories/base.repository";
import { CounterRepository } from "./repositories/counter.repository";
import { CoverRepository } from "./repositories/cover.repository";
import { DownloadJobRepository } from "./repositories/downloadJob.repository";
import { FolderRepository } from "./repositories/folder.repository";
import { PlaylistRepository } from "./repositories/playlist.repository";
import { QueueSnapshotRepository } from "./repositories/queueSnapshot.repository";
import { RadioStationRepository } from "./repositories/radio.repository";
import { StatsRepository } from "./repositories/stats.repository";
import { TagRepository } from "./repositories/tag.repository";
import { TrackRepository } from "./repositories/track.repository";
import { TrackChaptersRepository } from "./repositories/trackChapters.repository";
import type { TableName, TableSource } from "./tables";

export const REPOSITORY_TABLES = {
  tracks: ["tracks", "counters"],
  counters: ["counters", "tracks"],
  artists: ["artists"],
  albums: ["albums"],
  playlists: ["playlists"],
  folders: ["folders"],
  covers: ["covers"],
  tags: ["tags", "tracks"],
  downloadJobs: ["downloadJobs"],
  trackChapters: ["trackChapters"],
  radioStations: ["radioStations"],
  queueSnapshot: ["queueSnapshot"],
  stats: ["listenEvents", "tracks", "tags"],
} as const satisfies Record<string, readonly TableName[]>;

export type RepositoryName = keyof typeof REPOSITORY_TABLES;

export interface RepositoryMap {
  tracks: TrackRepository;
  counters: CounterRepository;
  artists: ArtistRepository;
  albums: AlbumRepository;
  playlists: PlaylistRepository;
  folders: FolderRepository;
  covers: CoverRepository;
  tags: TagRepository;
  downloadJobs: DownloadJobRepository;
  trackChapters: TrackChaptersRepository;
  radioStations: RadioStationRepository;
  queueSnapshot: QueueSnapshotRepository;
  stats: StatsRepository;
}

type TablesOf<R extends RepositoryName> = (typeof REPOSITORY_TABLES)[R][number];

// The repositories whose every table is in scope.
export type Scope<K extends TableName> = {
  [R in RepositoryName as TablesOf<R> extends K ? R : never]: RepositoryMap[R];
};

const REPOSITORY_FACTORIES: { [R in RepositoryName]: (source: TableSource) => RepositoryMap[R] } = {
  tracks: source => new TrackRepository(source),
  counters: source => new CounterRepository(source),
  artists: source => new ArtistRepository(source),
  albums: source => new AlbumRepository(source),
  playlists: source => new PlaylistRepository(source),
  folders: source => new FolderRepository(source),
  covers: source => new CoverRepository(source),
  tags: source => new TagRepository(source),
  downloadJobs: source => new DownloadJobRepository(source),
  trackChapters: source => new TrackChaptersRepository(source),
  radioStations: source => new RadioStationRepository(source),
  queueSnapshot: source => new QueueSnapshotRepository(source),
  stats: source => new StatsRepository(source),
};

const REPOSITORY_NAMES = Object.keys(REPOSITORY_TABLES) as RepositoryName[];

const bindRepositories = <K extends TableName>(tx: Transaction, tables: readonly K[]): Scope<K> => {
  const declared = new Set<TableName>(tables);
  const inScope = REPOSITORY_NAMES.filter(name => REPOSITORY_TABLES[name].every(table => declared.has(table)));
  return Object.fromEntries(inScope.map(name => [name, REPOSITORY_FACTORIES[name](tx)])) as Scope<K>;
};

export const unitOfWork = {
  // One rw transaction over `tables`; `work` gets the repositories bound to it. Throws DbError; an AppFailure from `work` passes through.
  run: <K extends TableName, T>(tables: readonly K[], work: (uow: Scope<K>) => Promise<T>): Promise<T> =>
    guarded(() => db.transaction("rw", [...tables], async (tx) => {
      // Awaiting here keeps the promise inside Dexie's zone; returning it bare settles outside and throws PrematureCommitError.
      const value = await work(bindRepositories(tx, tables));
      return value;
    })),
};
