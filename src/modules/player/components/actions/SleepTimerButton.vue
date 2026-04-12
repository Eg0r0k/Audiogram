<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        size="icon-sm"
        variant="ghost"
        :class="{ 'text-primary': playerStore.isSleepTimerActive }"
      >
        <IconMoonStars class="size-4.5" />
      </Button>
    </PopoverTrigger>

    <PopoverContent
      align="end"
      class="w-64 p-2"
    >
      <div class="mb-2 px-2 py-1">
        <div class="text-sm font-medium">
          {{ $t("player.sleepTimer") }}
        </div>
        <div class="text-xs text-muted-foreground">
          {{ statusText }}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-1">
        <Button
          v-for="preset in presets"
          :key="preset.minutes"
          class="justify-start"
          variant="ghost"
          @click="handlePreset(preset.minutes)"
        >
          <IconClockHour4 class="size-4.5" />
          {{ t("common.minutesShort", { count: preset.minutes }) }}
        </Button>
      </div>

      <div
        v-if="playerStore.isSleepTimerActive"
        class="mt-2 border-t border-border pt-2"
      >
        <Button
          class="w-full justify-start"
          variant="ghost"
          @click="handleCancel"
        >
          <IconPlayerStop class="size-4.5" />
          {{ $t("player.cancelSleepTimer") }}
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import IconMoonStars from "~icons/tabler/moon-stars";
import IconClockHour4 from "~icons/tabler/clock-hour-4";
import IconPlayerStop from "~icons/tabler/player-stop";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDuration } from "@/lib/format/time";
import { usePlayerStore } from "@/modules/player/store/player.store";

const presets = [
  { minutes: 5 },
  { minutes: 10 },
  { minutes: 30 },
  { minutes: 45 },
];

const { t } = useI18n();
const playerStore = usePlayerStore();
const isOpen = ref(false);

const statusText = computed(() => {
  if (playerStore.sleepTimerRemainingMs > 0) {
    return t("player.sleepTimerScheduledIn", {
      time: formatDuration(playerStore.sleepTimerRemainingMs / 1000),
    });
  }

  return t("player.sleepTimerOff");
});

const handlePreset = (minutes: number) => {
  playerStore.setSleepTimer(minutes * 60 * 1000);
  isOpen.value = false;
};

const handleCancel = () => {
  playerStore.cancelSleepTimer();
  isOpen.value = false;
};
</script>
