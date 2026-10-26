import Dexie, { type Collection, type Table, type UpdateSpec } from "dexie";
import type { TrackEntity } from "@/db/entities";
import { unique } from "@/lib/math";
import type { AlbumId, ArtistId, TagId, TrackId } from "@/types/ids";
import { isDescendingSort, trackSortField, type TrackSortKey } from "@/types/track-sort";
import { guarded } from "./base.repository";

// Dexie's own floor and ceiling of the IndexedDB key space. They span numbers
// and strings alike, so a sort field needs no per-type bounds and no table
// saying which type it holds: a field left out of such a table would silently
// page through an empty range instead of failing.
const FIELD_FLOOR: unknown = Dexie.minKey;
const FIELD_CEILING: unknown = Dexie.maxKey;

type TrackTable = Table<TrackEntity, TrackId>;
type TrackCollection = Collection<TrackEntity, TrackId>;
type TrackFilter = (row: TrackEntity) => boolean;

export type TrackScopeSource
  = | { kind: "all" }
    | { kind: "album"; albumId: AlbumId }
    | { kind: "artist"; artistId: ArtistId }
    | { kind: "tag"; tagId: TagId }
    | { kind: "ids"; ids: readonly TrackId[] };

export interface TrackScopeSpec {
  source: TrackScopeSource;
  members: boolean;
  // Shadow rows included: a like does not pin.
  liked: boolean;
}

export interface TrackRowsOptions {
  sort?: TrackSortKey;
  offset?: number;
  limit?: number;
}

export interface TrackPlan {
  kind: "collection";
  index: string;
  ordered: boolean;
  reverse: boolean;
  build: (table: TrackTable) => TrackCollection;
  filter?: TrackFilter;
  inMemorySort?: TrackSortKey;
  keyOrder?: readonly TrackId[];
}

interface Walk {
  index: string;
  open: (table: TrackTable) => TrackCollection;
  ordered?: boolean;
  reverse?: boolean;
  coversMembers?: boolean;
  coversLiked?: boolean;
  inMemorySort?: TrackSortKey;
  keyOrder?: readonly TrackId[];
}

const isMember: TrackFilter = row => row.pinned === 1;
const isLiked: TrackFilter = row => (row.likedAt ?? 0) > 0;

const filterOf = (members: boolean, liked: boolean): TrackFilter | undefined => {
  if (members && liked) return row => isMember(row) && isLiked(row);
  if (members) return isMember;
  if (liked) return isLiked;
  return undefined;
};

const likedWalk = (sort: TrackSortKey | undefined): Walk => {
  if (!sort) {
    return { index: "likedAt", open: table => table.where("likedAt").above(0), ordered: true, reverse: true, coversLiked: true };
  }
  const index = `[${trackSortField(sort)}+likedAt]`;
  // The sort field spans the whole key space; `likedAt` is what narrows the
  // range, and an unliked row carries none at all, so it is not in this
  // index to begin with.
  return {
    index,
    open: table => table.where(index).between([FIELD_FLOOR, 1], [FIELD_CEILING, Infinity]),
    ordered: true,
    reverse: isDescendingSort(sort),
    coversLiked: true,
  };
};

const membersWalk = (sort: TrackSortKey | undefined): Walk => {
  if (!sort) return { index: "pinned", open: table => table.where("pinned").equals(1), coversMembers: true };
  const index = `[pinned+${trackSortField(sort)}]`;
  return {
    index,
    open: table => table.where(index).between([1, FIELD_FLOOR], [1, FIELD_CEILING], true, true),
    ordered: true,
    reverse: isDescendingSort(sort),
    coversMembers: true,
  };
};

const allWalk = (spec: TrackScopeSpec, sort: TrackSortKey | undefined): Walk => {
  if (spec.liked) return likedWalk(sort);
  if (spec.members) return membersWalk(sort);
  if (!sort) return { index: "id", open: table => table.toCollection() };
  const field = trackSortField(sort);
  return { index: field, open: table => table.orderBy(field), ordered: true, reverse: isDescendingSort(sort) };
};

const walkOf = (spec: TrackScopeSpec, sort: TrackSortKey | undefined): Walk => {
  const { source } = spec;
  switch (source.kind) {
    case "all":
      return allWalk(spec, sort);
    case "album":
      return spec.members
        ? { index: "[albumId+pinned]", open: table => table.where("[albumId+pinned]").equals([source.albumId, 1]), coversMembers: true, inMemorySort: sort }
        : { index: "albumId", open: table => table.where("albumId").equals(source.albumId), inMemorySort: sort };
    case "artist":
      return { index: "artistIds", open: table => table.where("artistIds").equals(source.artistId), inMemorySort: sort };
    case "tag":
      return { index: "tagIds", open: table => table.where("tagIds").equals(source.tagId), inMemorySort: sort };
    case "ids":
      return { index: "id", open: table => table.where("id").anyOf(source.ids), inMemorySort: sort, keyOrder: sort ? undefined : source.ids };
  }
};

export const plan = (spec: TrackScopeSpec, sort?: TrackSortKey): TrackPlan => {
  const walk = walkOf(spec, sort);
  const filter = filterOf(spec.members && !walk.coversMembers, spec.liked && !walk.coversLiked);
  const reverse = walk.reverse ?? false;
  return {
    kind: "collection",
    index: walk.index,
    ordered: walk.ordered ?? false,
    reverse,
    build: (table) => {
      const opened = walk.open(table);
      const filtered = filter ? opened.and(filter) : opened;
      return reverse ? filtered.reverse() : filtered;
    },
    filter,
    inMemorySort: walk.inMemorySort,
    keyOrder: walk.keyOrder,
  };
};

// The plain `<`/`>` comparison Dexie's `sortBy` uses, so an in-memory sort
// orders ties exactly as `sortBy` did; descending is ascending reversed.
const sortRows = (rows: TrackEntity[], sort: TrackSortKey): TrackEntity[] => {
  const field = trackSortField(sort);
  rows.sort((a, b) => {
    const valueA = a[field];
    const valueB = b[field];
    if (valueA < valueB) return -1;
    if (valueA > valueB) return 1;
    return 0;
  });
  return isDescendingSort(sort) ? rows.reverse() : rows;
};

const slicePage = (rows: TrackEntity[], offset: number, limit: number | undefined): TrackEntity[] =>
  rows.slice(offset, limit === undefined ? undefined : offset + limit);

const pageOf = (collection: TrackCollection, offset: number, limit: number | undefined): TrackCollection => {
  const skipped = offset > 0 ? collection.offset(offset) : collection;
  return limit === undefined ? skipped : skipped.limit(limit);
};

export class TrackScope {
  constructor(
    private readonly table: TrackTable,
    private readonly spec: TrackScopeSpec,
  ) {}

  members(): TrackScope {
    return new TrackScope(this.table, { ...this.spec, members: true });
  }

  rows(options: TrackRowsOptions = {}): Promise<TrackEntity[]> {
    return guarded(() => this.read(plan(this.spec, options.sort), options));
  }

  ids(sort?: TrackSortKey): Promise<TrackId[]> {
    return guarded(async () => {
      const planned = plan(this.spec, sort);
      if (planned.inMemorySort) return (await this.read(planned, {})).map(row => row.id);
      const keys = await planned.build(this.table).primaryKeys();
      if (!planned.keyOrder) return keys;
      const present = new Set(keys);
      return unique(planned.keyOrder).filter(id => present.has(id));
    });
  }

  count(): Promise<number> {
    return guarded(() => plan(this.spec).build(this.table).count());
  }

  sumDuration(): Promise<number> {
    return guarded(async () => {
      let total = 0;
      await plan(this.spec)
        .build(this.table)
        .each((row) => { total += row.duration; });
      return total;
    });
  }

  first(): Promise<TrackEntity | undefined> {
    return guarded(async () => {
      const planned = plan(this.spec);
      if (planned.keyOrder) return (await this.read(planned, { limit: 1 }))[0];
      return planned.build(this.table).first();
    });
  }

  modify(changes: UpdateSpec<TrackEntity> | ((row: TrackEntity) => void)): Promise<number> {
    return guarded(() => {
      const collection = plan(this.spec).build(this.table);
      // TypeScript picks one of Dexie's modify overloads per branch; the union matches neither.
      if (typeof changes === "function") return collection.modify(changes);
      return collection.modify(changes);
    });
  }

  delete(): Promise<number> {
    return guarded(() => plan(this.spec).build(this.table).delete());
  }

  private async read(planned: TrackPlan, { offset = 0, limit }: TrackRowsOptions): Promise<TrackEntity[]> {
    if (planned.keyOrder) {
      const { filter } = planned;
      const found = await this.table.bulkGet(unique(planned.keyOrder));
      const rows = found.filter((row): row is TrackEntity => row !== undefined && (!filter || filter(row)));
      return slicePage(rows, offset, limit);
    }
    if (planned.inMemorySort) {
      return slicePage(sortRows(await planned.build(this.table).toArray(), planned.inMemorySort), offset, limit);
    }
    return pageOf(planned.build(this.table), offset, limit).toArray();
  }
}
