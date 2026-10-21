import { computed, type Ref } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { parseTrackRef, type SourceKind } from "@/types/track-ref";
import { sources } from "@/modules/sources";
import { localCopyQueries } from "@/queries/localCopy.queries";
import { ephemeralRemoteDto, trackHasLocalFile } from "@/modules/tracks/lib/trackPredicates";
import type { TrackId } from "@/types/ids";
import type { TrackMenuSubject } from "../components/menu/type";

//
// "WHAT can be done with this subject" — the second axis of the menu system.
// Contexts answer "WHERE the menu is open"; capabilities answer everything
// source/pinned/offline-dependent, so item components never inspect the
// source themselves.
//
export interface TrackMenuCaps {
  kind: TrackMenuSubject["kind"];
  source: SourceKind;
  /**
   * The id downloads and offline copies key on: the row id, the DTO id, or
   * the catalog track a playing stream names in its URL. Null for a stream
   * with no catalog identity (file, radio).
   */
  trackId: TrackId | null;
  /** A library row with pinned = 1 — visible on library pages. */
  isInLibrary: boolean;
  /** A Dexie row exists at all (shadow rows included). */
  isPinned: boolean;
  /** A local track downloaded from this remote id exists (TrackEntity.sourceRef). */
  hasLocalCopy: boolean;
  /** Local file OR downloaded copy → "Save as…" can produce a file. */
  canExportFile: boolean;
  /** The source can hand over a file and no copy exists yet. */
  canDownload: boolean;
  canOpenExternal: boolean;
}

/** The details panel reads the Dexie row; caps-less call sites are library-only and always have one. */
export const canShowDetails = (caps?: TrackMenuCaps | null): boolean => caps?.isPinned ?? true;

function subjectTrackId(subject: TrackMenuSubject | null): TrackId | null {
  if (!subject) return null;
  if (subject.kind === "library") return subject.track.id;
  if (subject.kind === "remote") return subject.dto.id;
  return ephemeralRemoteDto(subject.track)?.id ?? null;
}

/** Capability lookup that tolerates sources not registered yet (nd until M2). */
function sourceCanDownload(kind: SourceKind): boolean {
  try {
    return sources.get(kind).capabilities.download;
  }
  catch {
    return false;
  }
}

/**
 * Computes the capability set for the active menu subject. The synchronous
 * part derives from the subject itself; the local copy comes from the
 * `localCopyQueries.byRemoteId(trackId)` query (cache-synced by the download
 * manager, which imports the download as a local track).
 *
 * Shells compute this once per active subject and pass it down next to
 * `actions` — item components receive ready-made booleans.
 */
export function useTrackMenuCaps(subject: Ref<TrackMenuSubject | null>): Ref<TrackMenuCaps> {
  const trackId = computed(() => subjectTrackId(subject.value));
  const source = computed<SourceKind>(() => (trackId.value ? parseTrackRef(trackId.value).kind : "local"));
  const isRemote = computed(() => source.value !== "local");

  const { data: localCopy } = useQuery(computed(() => localCopyQueries.byRemoteId(isRemote.value ? trackId.value : null)));

  return computed<TrackMenuCaps>(() => {
    const current = subject.value;
    const isLibrary = current?.kind === "library";
    const hasLocalCopy = !!localCopy.value;
    const hasLocalFile = isLibrary && trackHasLocalFile(current.track);

    return {
      kind: current?.kind ?? "library",
      source: source.value,
      trackId: trackId.value,
      isInLibrary: isLibrary && (current.track.pinned ?? 1) === 1,
      isPinned: isLibrary,
      hasLocalCopy,
      canExportFile: hasLocalFile || hasLocalCopy,
      canDownload: isRemote.value && sourceCanDownload(source.value) && !hasLocalCopy,
      canOpenExternal: isRemote.value,
    };
  });
}
