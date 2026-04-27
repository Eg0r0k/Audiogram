import { useI18n } from "vue-i18n";
import { usePlayerStore } from "../store/player.store";
import { computed } from "vue";
import { formatDuration } from "@/lib/format/time";

export const SLEEP_TIMER_PRESETS = [
  { minutes: 5 },
  { minutes: 10 },
  { minutes: 30 },
  { minutes: 45 },
] as const;

export const useSleepTimer = () => {
  const { t } = useI18n();
  const playerStore = usePlayerStore();
  const isActive = computed(() => playerStore.isSleepTimerActive);
  const remainingMs = computed(() => playerStore.sleepTimerRemainingMs);
  const remainingText = computed(() =>
    formatDuration(remainingMs.value / 1000),
  );
  const statusText = computed(() => {
    if (remainingMs.value > 0) {
      return t("player.sleepTimerScheduledIn", {
        time: formatDuration(remainingMs.value / 1000),
      });
    }
    return t("player.sleepTimerOff");
  });

  const setTimer = (minutes: number) => {
    playerStore.setSleepTimer(minutes * 60 * 1000);
  };
  const cancel = () => {
    playerStore.cancelSleepTimer();
  };

  return {
    presets: SLEEP_TIMER_PRESETS,
    isActive,
    remainingMs,
    remainingText,
    statusText,
    setTimer,
    cancel,
  };
};
