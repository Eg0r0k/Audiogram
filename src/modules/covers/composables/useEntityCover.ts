import { computed, type MaybeRefOrGetter, toValue } from "vue";
import { useQuery } from "@tanstack/vue-query";
import { coverRepository } from "@/db/repositories";
import type { CoverOwnerType } from "@/db/entities";
import { useObjectUrl } from "@vueuse/core";
import { queryKeys } from "@/lib/query-keys";

export function useEntityCover(
  ownerType: MaybeRefOrGetter<CoverOwnerType | null | undefined>,
  ownerId: MaybeRefOrGetter<string | null | undefined>,
) {
  const query = useQuery({
    queryKey: computed(() => {
      const type = toValue(ownerType);
      const id = toValue(ownerId);

      if (!type || !id) return ["covers", "idle"] as const;
      return queryKeys.covers.detail(type, id);
    }),
    queryFn: async () => {
      const type = toValue(ownerType);
      const id = toValue(ownerId);

      if (!type || !id) return null;

      const result = await coverRepository.findByOwner(type, id);
      if (result.isErr()) throw result.error;

      return result.value?.blob ?? null;
    },
    enabled: computed(() => {
      const type = toValue(ownerType);
      const id = toValue(ownerId);
      return !!type && !!id;
    }),
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
