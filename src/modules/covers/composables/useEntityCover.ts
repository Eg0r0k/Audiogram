import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { useQuery } from "@tanstack/vue-query";
import type { CoverOwnerType } from "@/db/entities";
import { useObjectUrl } from "@vueuse/core";
import { queryKeys } from "@/lib/query-keys";
import { getCoverBlob } from "@/queries/cover.queries";

export function useEntityCover(
  ownerType: MaybeRefOrGetter<CoverOwnerType | null | undefined>,
  ownerId: MaybeRefOrGetter<string | null | undefined>,
) {
  const query = useQuery({
    queryKey: computed(() => {
      const type = toValue(ownerType);
      const id = toValue(ownerId);

      return type && id
        ? queryKeys.covers.detail(type, id)
        : ["covers", "idle", "idle"] as const;
    }),
    queryFn: async () => {
      const type = toValue(ownerType);
      const id = toValue(ownerId);

      if (!type || !id) {
        return null;
      }

      return getCoverBlob(type, id);
    },
    enabled: computed(() => !!toValue(ownerType) && !!toValue(ownerId)),
  });

  const url = useObjectUrl(computed(() => query.data.value));

  return {
    blob: query.data,
    url,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}
