import { computed, ref, toValue, type MaybeRefOrGetter } from "vue";
import { useQueryClient } from "@tanstack/vue-query";
import { toast } from "vue-sonner";
import { i18n } from "@/app/i18n";
import { getLogger } from "@/lib/logger";
import { queryKeys } from "@/queries/query-keys";
import type { SourceKind } from "@/types/track-ref";
import { sources } from "../registry";
import type { LikeableEntity } from "../types";
import { useSourceAlbumsInfinite, useSourceArtists, useSourcePlaylists } from "./useSourceCatalog";

//
// The like state of one catalog entity, read off the source's liked list —
// the same query the sidebar renders, so a like here and a row there never
// disagree. Sources without entity likes get `state: undefined` and the
// page shows no heart; the local library never has one either.
//

export interface EntityLikeState {
  isLiked: boolean;
  isPending: boolean;
  toggle: () => void;
}

export const useEntityLike = (
  kind: MaybeRefOrGetter<SourceKind | null>,
  entity: LikeableEntity,
  id: MaybeRefOrGetter<string | null>,
) => {
  const queryClient = useQueryClient();

  const provider = computed(() => {
    const resolved = toValue(kind);
    return resolved ? sources.find(resolved) : undefined;
  });
  const supported = computed(() => !!provider.value?.setEntityLiked);

  // Only the one list this entity lives in is queried; the other two park on
  // skipToken through a null kind.
  const listKind = (wanted: LikeableEntity) =>
    computed(() => (supported.value && entity === wanted ? toValue(kind) : null));

  const artists = useSourceArtists(listKind("artist"));
  const albums = useSourceAlbumsInfinite(listKind("album"), "alpha");
  const playlists = useSourcePlaylists(listKind("playlist"));

  const likedIds = computed<ReadonlySet<string> | null>(() => {
    switch (entity) {
      case "artist": return artists.data.value ? new Set(artists.data.value.map(row => row.id)) : null;
      case "album": return albums.data.value ? new Set(albums.data.value.pages.flat().map(row => row.id)) : null;
      case "playlist": return playlists.data.value ? new Set(playlists.data.value.map(row => row.id)) : null;
      default: return null;
    }
  });

  const listKey = (resolved: SourceKind) => {
    switch (entity) {
      case "artist": return queryKeys.source.artists(resolved);
      case "album": return queryKeys.source.albums(resolved);
      case "playlist": return queryKeys.source.playlists(resolved);
    }
  };

  // Set for the duration of a request and until the refetched list agrees.
  const optimistic = ref<boolean | null>(null);
  const isPending = ref(false);

  const isLiked = computed(() => {
    if (optimistic.value !== null) return optimistic.value;
    const target = toValue(id);
    return target !== null && (likedIds.value?.has(target) ?? false);
  });

  const toggle = async (): Promise<void> => {
    const target = toValue(id);
    const resolved = toValue(kind);
    const current = provider.value;
    if (!target || !resolved || !current?.setEntityLiked || isPending.value) return;

    const next = !isLiked.value;
    optimistic.value = next;
    isPending.value = true;
    const result = await current.setEntityLiked(entity, target, next);
    isPending.value = false;

    if (result.isErr()) {
      optimistic.value = null;
      getLogger().warn(`[Sources] ${next ? "Liking" : "Unliking"} ${entity} ${target} at ${resolved} failed (${result.error.kind}): ${result.error.message}`);
      toast.error(i18n.global.t("media.likeFailed"));
      return;
    }
    // invalidateQueries resolves once the active list refetched, so the
    // optimistic flag hands over to a list that already agrees with it.
    await queryClient.invalidateQueries({ queryKey: listKey(resolved) });
    optimistic.value = null;
  };

  const state = computed<EntityLikeState | undefined>(() =>
    (supported.value
      ? {
          isLiked: isLiked.value,
          isPending: isPending.value,
          toggle: () => { toggle().catch(() => undefined); },
        }
      : undefined),
  );

  return { supported, isLiked, isPending, toggle, state };
};
