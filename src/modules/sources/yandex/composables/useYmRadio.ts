import { computed, ref } from "vue";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { getLogger } from "@/lib/logger";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { createYmRadioSession, MY_WAVE_STATION } from "../radio/radio-session";

/** Starts a Yandex station in the queue; "My Wave" by default. */
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
        toast.error(result.error.kind === "FORBIDDEN"
          ? t("settings.sources.ym.noPlus")
          : t("queue.radioFailed"));
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
