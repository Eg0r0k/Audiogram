import { computed, ref } from "vue";
import { toaster } from "@/app/toaster";
import { useI18n } from "vue-i18n";
import { getLogger } from "@/lib/logger";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { createYmRadioSession, MY_WAVE_STATION } from "../radio/radio-session";

export const useYmRadio = () => {
  const queue = useQueueStore();
  const { t } = useI18n();
  const isStarting = ref(false);

  const start = async (station: string = MY_WAVE_STATION): Promise<void> => {
    if (isStarting.value) return;
    isStarting.value = true;
    try {
      const result = await queue.startRadio(createYmRadioSession(station));
      if (result.isErr()) {
        getLogger().warn(`[YM radio] ${station} did not start (${result.error.kind}): ${result.error.message}`);
        // No access is not something a second try changes.
        toaster.add(result.error.kind === "FORBIDDEN"
          ? { title: t("settings.sources.ym.stationNeedsPlus"), color: "destructive" }
          : {
              title: t("queue.radioFailed"),
              color: "destructive",
              actions: [{
                label: t("common.retry"),
                onClick: () => {
                  start(station).catch(() => undefined);
                },
              }],
            });
      }
    }
    finally {
      isStarting.value = false;
    }
  };

  return {
    isStarting: computed(() => isStarting.value),
    isPlayingRadio: computed(() => queue.isRadio),
    start,
  };
};
