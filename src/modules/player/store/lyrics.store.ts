import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";
import { usePlayerStore } from "./player.store";
import { findActiveLyricsIndex, type LyricsLine } from "../lib/lrc";
import { loadTrackLyrics, type TrackLyricsLoadResult } from "../service/track-lyrics-loader.service";
import { isLibraryTrack, type PlayerTrack } from "@/types/track";

export type LyricsStatus = "idle" | "loading" | "ready" | "error";

export const useLyricsStore = defineStore("lyrics", () => {
  const playerStore = usePlayerStore();

  const result = shallowRef<TrackLyricsLoadResult>({ status: "idle" });
  const isLoading = ref(false);
  const previewOffsetMs = ref<number | null>(null);

  let requestId = 0;
  // What the current lyrics were loaded for. The same track is announced
  // more than once (a cold start after a restore, a repeat-one loop) and
  // reloading would blank the panel for nothing. A lyrics file attached to
  // the track changes its key, so that still reloads; a file replaced under
  // the same path does not, which is what `force` is for.
  let loadedKey: string | null = null;

  const keyOf = (track: PlayerTrack | null): string | null => {
    if (!track) return null;
    const lyricsPath = isLibraryTrack(track) ? track.lyricsPath ?? "" : "";
    return `${track.kind}:${track.id}:${lyricsPath}`;
  };

  const status = computed<LyricsStatus>(() => (isLoading.value ? "loading" : result.value.status));
  const ready = computed(() => (result.value.status === "ready" ? result.value : null));
  const reason = computed(() => (result.value.status === "error" ? result.value.reason : null));
  const kind = computed(() => ready.value?.lyrics.kind ?? null);
  const lines = computed<LyricsLine[]>(() => (ready.value?.lyrics.kind === "synced" ? ready.value.lyrics.lines : []));
  const plainLines = computed<string[]>(() => (ready.value?.lyrics.kind === "plain" ? ready.value.lyrics.lines : []));
  const raw = computed(() => ready.value?.raw ?? null);
  const source = computed(() => ready.value?.source ?? null);

  const offsetMs = computed(() => {
    if (previewOffsetMs.value !== null) return previewOffsetMs.value;
    const track = playerStore.currentTrack;
    return isLibraryTrack(track) ? track.lyricsOffsetMs ?? 0 : 0;
  });

  const activeLineIndex = computed(() => {
    if (lines.value.length === 0) return -1;
    return findActiveLyricsIndex(lines.value, playerStore.currentTime - offsetMs.value / 1000);
  });

  const setPreviewOffset = (ms: number | null) => {
    previewOffsetMs.value = ms;
  };

  const loadFor = async (track: PlayerTrack | null, { force = false }: { force?: boolean } = {}): Promise<void> => {
    const key = keyOf(track);
    if (!force && key !== null && key === loadedKey && status.value !== "error") return;
    if (key !== loadedKey) previewOffsetMs.value = null;
    loadedKey = key;
    const id = ++requestId;
    result.value = { status: "idle" };
    // Ephemeral tracks with metadata also resolve lyrics (lrclib lookup).
    isLoading.value = Boolean(track && (isLibraryTrack(track) || (track.title && track.artist)));

    const next = await loadTrackLyrics(track);
    if (id !== requestId) return;

    result.value = next;
    isLoading.value = false;
  };

  const reload = (): Promise<void> => loadFor(playerStore.currentTrack, { force: true });

  return {
    status,
    reason,
    kind,
    lines,
    plainLines,
    raw,
    source,
    offsetMs,
    activeLineIndex,
    setPreviewOffset,
    loadFor,
    reload,
  };
});
