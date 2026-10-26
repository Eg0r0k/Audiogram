import { vi, type Mock } from "vitest";
import type { TrackEntity } from "@/db/entities";
import type { TrackRepository } from "@/db/repositories/track.repository";
import type { TrackScope } from "@/db/repositories/track.scope";
import { isDescendingSort, trackSortField, type TrackSortKey } from "@/types/track-sort";

const SCOPE_FACTORIES = ["all", "members", "liked", "inAlbum", "byArtist", "withTag", "withIds"] as const;

type ScopeFactory = (typeof SCOPE_FACTORIES)[number];

export type FakeTrackScope = { [K in Exclude<keyof TrackScope, "members">]: Mock<TrackScope[K]> } & {
  members: Mock<() => FakeTrackScope>;
};

export type FakeTrackScopes = {
  [K in ScopeFactory]?: readonly TrackEntity[] | ((...args: Parameters<TrackRepository[K]>) => readonly TrackEntity[]);
};

export type FakeTrackRepository = {
  [K in ScopeFactory]: Mock<(...args: Parameters<TrackRepository[K]>) => FakeTrackScope>;
};

type ScopeRows = readonly TrackEntity[] | ((...args: unknown[]) => readonly TrackEntity[]);

const ordered = (rows: readonly TrackEntity[], sort: TrackSortKey | undefined): TrackEntity[] => {
  if (!sort) return [...rows];
  const field = trackSortField(sort);
  const ascending = [...rows].sort((a, b) => {
    if (a[field] < b[field]) return -1;
    if (a[field] > b[field]) return 1;
    return 0;
  });
  return isDescendingSort(sort) ? ascending.reverse() : ascending;
};

export const fakeTrackScope = (rows: readonly TrackEntity[]): FakeTrackScope => {
  const scope: FakeTrackScope = {
    members: vi.fn(() => scope),
    rows: vi.fn<TrackScope["rows"]>(async ({ sort, offset = 0, limit } = {}) =>
      ordered(rows, sort).slice(offset, limit === undefined ? undefined : offset + limit)),
    ids: vi.fn<TrackScope["ids"]>(async sort => ordered(rows, sort).map(row => row.id)),
    count: vi.fn<TrackScope["count"]>(async () => rows.length),
    sumDuration: vi.fn<TrackScope["sumDuration"]>(async () => rows.reduce((total, row) => total + row.duration, 0)),
    first: vi.fn<TrackScope["first"]>(async () => rows[0]),
    modify: vi.fn<TrackScope["modify"]>(async () => rows.length),
    delete: vi.fn<TrackScope["delete"]>(async () => rows.length),
  };
  return scope;
};

// One scope per factory and argument list, so a test can reach the projection
// the code under test called: `repository.inAlbum(id).count`.
export const fakeTrackRepository = (scopes: FakeTrackScopes): FakeTrackRepository => {
  const factory = (name: ScopeFactory) => {
    const made = new Map<string, FakeTrackScope>();
    return vi.fn((...args: unknown[]) => {
      const entry = scopes[name] as ScopeRows | undefined;
      if (entry === undefined) throw new Error(`fakeTrackRepository: no rows given for ${name}()`);
      const key = JSON.stringify(args);
      const known = made.get(key);
      if (known) return known;
      const scope = fakeTrackScope(typeof entry === "function" ? entry(...args) : entry);
      made.set(key, scope);
      return scope;
    });
  };
  return Object.fromEntries(SCOPE_FACTORIES.map(name => [name, factory(name)])) as unknown as FakeTrackRepository;
};
