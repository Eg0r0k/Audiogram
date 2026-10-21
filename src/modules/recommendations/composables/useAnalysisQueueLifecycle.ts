import { onMounted, onUnmounted, watch } from "vue";
import { useGeneralSettings } from "@/modules/settings/store/general";
import { getLogger } from "@/lib/logger";
import { useAnalysisQueue } from "./useAnalysisQueue";
import { formatError } from "@/lib/errors";

const STARTUP_DELAY_MS = 3000;

export const useAnalysisQueueLifecycle = () => {
  const { analyzeTracks } = useGeneralSettings();
  const { start, stop } = useAnalysisQueue();

  let startupTimer: ReturnType<typeof setTimeout> | undefined;

  onMounted(() => {
    if (analyzeTracks.value) {
      startupTimer = setTimeout(() => {
        start().catch(error => getLogger().error(`[Analysis] Starting the analysis queue failed: ${formatError(error)}`));
      }, STARTUP_DELAY_MS);
    }
  });

  watch(analyzeTracks, (enabled) => {
    if (enabled) start().catch(error => getLogger().error(`[Analysis] Starting the analysis queue failed: ${formatError(error)}`));
    else stop();
  });

  onUnmounted(() => {
    clearTimeout(startupTimer);
  });
};
