import { onMounted, onUnmounted } from "vue";
import { useUpdateStore } from "../store/update.store";

const STARTUP_DELAY_MS = 5000;
const DEFAULT_INTERVAL_MS = 4 * 60 * 60 * 1000;

export interface UpdateSchedulerOptions {
  intervalMs?: number;
  checkOnStartup?: boolean;
}

export const useUpdateScheduler = (options: UpdateSchedulerOptions = {}) => {
  const {
    intervalMs = DEFAULT_INTERVAL_MS,
    checkOnStartup = true,
  } = options;

  const store = useUpdateStore();

  let startupTimer: ReturnType<typeof setTimeout> | null = null;
  let intervalTimer: ReturnType<typeof setInterval> | null = null;

  const scheduleCheck = () => {
    store.check();
  };

  onMounted(() => {
    if (checkOnStartup) {
      startupTimer = setTimeout(scheduleCheck, STARTUP_DELAY_MS);
    }

    intervalTimer = setInterval(scheduleCheck, intervalMs);
  });

  onUnmounted(() => {
    if (startupTimer !== null) clearTimeout(startupTimer);
    if (intervalTimer !== null) clearInterval(intervalTimer);
  });

  return {
    checkNow: () => store.check(),
  };
};
