import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { injectResponsiveMenu } from "@/components/ui/responsive-menu";
import { buildTrackMenu, type TrackMenuFacts } from "@/modules/tracks/lib/trackMenu";

// The shells render the responsive menu that owns the mode, so only its content can read it.
export const useTrackMenuModel = (facts: MaybeRefOrGetter<TrackMenuFacts>) => {
  const menu = injectResponsiveMenu();
  return computed(() => buildTrackMenu({ ...toValue(facts), mode: menu?.mode.value ?? "popper" }));
};
