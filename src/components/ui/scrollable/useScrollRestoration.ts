import { onMounted, onActivated, nextTick, watch, toRef } from "vue";
import { useRoute, onBeforeRouteLeave } from "vue-router";
import type { MaybeRefOrGetter } from "vue";
import type Scrollable from "@/components/ui/scrollable/Scrollable.vue";

const scrollStore = new Map<string, number>();

export function useScrollRestoration(
  scrollableRef: MaybeRefOrGetter<InstanceType<typeof Scrollable> | null>,
) {
  const route = useRoute();
  const ref = toRef(scrollableRef);

  const save = () => {
    const el = ref.value;
    if (el) {
      scrollStore.set(route.fullPath, el.scrollPosition as unknown as number);
    }
  };

  const restore = async () => {
    const saved = scrollStore.get(route.fullPath);
    if (!saved) return;

    await nextTick();

    const el = ref.value;
    if (el) {
      el.scrollTo({ position: saved, behavior: "instant" });
      return;
    }

    const stop = watch(ref, (instance) => {
      if (!instance) return;
      instance.scrollTo({ position: saved, behavior: "instant" });
      stop();
    });
  };

  onBeforeRouteLeave(save);
  onMounted(restore);
  onActivated(restore);
}
