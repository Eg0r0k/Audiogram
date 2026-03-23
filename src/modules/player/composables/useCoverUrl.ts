import { ref, watch, type MaybeRefOrGetter, toValue } from "vue";
import { getCoverUrl } from "@/lib/storage";

export function useCoverUrl(coverPath: MaybeRefOrGetter<string | undefined | null>) {
  const coverUrl = ref<string | undefined>(undefined);

  watch(
    () => toValue(coverPath),
    async (path) => {
      coverUrl.value = await getCoverUrl(path ?? undefined);
    },
    { immediate: true },
  );

  return coverUrl;
}
