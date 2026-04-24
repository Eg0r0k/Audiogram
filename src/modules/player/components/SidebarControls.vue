<template>
  <div class="flex min-w-[180px] w-[30%] justify-end pr-1">
    <div class="flex w-full gap-0.5 justify-end items-center grow">
      <Button
        variant="ghost"
        class="mr-2 h-auto rounded-full px-2 gap-0.5 py-1 text-sm font-medium text-muted-foreground select-none whitespace-nowrap"
        @click="toggleTimeDisplayMode"
      >
        <span>{{ timeDisplay.current }}</span>
        <span class="mx-0.5">/</span>
        <span :class="{ 'text-red-500 font-semibold': playerStore.isLiveStream }">
          {{ timeDisplay.duration }}
        </span>
      </Button>

      <VolumeButton />

      <Button
        size="icon-sm"
        variant="ghost"
        :class="{ 'text-primary': isQueueOpen }"
        :aria-label="$t('queue.title')"
        :title="$t('queue.title')"
        @click="toggleQueuePanel"
      >
        <IconPlaylist class="size-4.5" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            size="icon-sm"
            variant="ghost"
          >
            <IconCategory class="size-4.5" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          class="w-52"
        >
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <IconMoonStars
                class="size-5"
              />
              <span>
                {{ $t("player.sleepTimer") }}
              </span>
              <span
                v-if="playerStore.isSleepTimerActive"
                class="ml-auto text-xs text-muted-foreground"
              >
                {{ remainingText }}
              </span>
            </DropdownMenuSubTrigger>

            <DropdownMenuSubContent>
              <DropdownMenuLabel class="text-xs text-muted-foreground font-normal">
                {{ statusText }}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                v-for="preset in presets"
                :key="preset.minutes"
                @click="handlePreset(preset.minutes)"
              >
                <IconClockHour4 class="size-5 " />
                {{ t("common.minutesShort", { count: preset.minutes }) }}
              </DropdownMenuItem>

              <template v-if="playerStore.isSleepTimerActive">
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  @click="playerStore.cancelSleepTimer()"
                >
                  <IconPlayerStop class="size-5" />
                  {{ $t("player.cancelSleepTimer") }}
                </DropdownMenuItem>
              </template>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem @click="router.push(routeLocation.settingsAudio())">
            <IconEqualizer class="size-5" />
            {{ $t("player.equalizer") }}
          </DropdownMenuItem>
          <DropdownMenuItem
            v-if="pip.PIP_SUPPORTED"
            :class="{ 'text-primary': pip.isPipOpen.value }"
            @click="handlePipToggle"
          >
            <IconPIP class="size-5" />
            {{ $t("player.pip") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { App, computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { formatDuration } from "@/lib/format/time";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import IconCategory from "~icons/tabler/category";
import IconMoonStars from "~icons/tabler/moon-stars";
import IconClockHour4 from "~icons/tabler/clock-hour-4";
import IconPlayerStop from "~icons/tabler/circle-minus";
import IconEqualizer from "~icons/tabler/adjustments-horizontal";
import IconPIP from "~icons/tabler/picture-in-picture";

import VolumeButton from "./actions/VolumeButton.vue";
import { useRouter } from "vue-router";
import { routeLocation } from "@/app/router/route-locations";
import { getActivePinia, Pinia } from "pinia";
import { usePictureInPicture } from "@/composables/usePictureInPicture";
import { i18n } from "@/app/i18n";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import IconPlaylist from "~icons/tabler/playlist";

import PIPContent from "./pip/PIPContent.vue";
import { useQueryClient, VueQueryPlugin } from "@tanstack/vue-query";
const router = useRouter();

const presets = [
  { minutes: 5 },
  { minutes: 10 },
  { minutes: 30 },
  { minutes: 45 },
];

const { t } = useI18n();
const playerStore = usePlayerStore();
const rightPanelStore = useRightPanelStore();
const timeDisplayMode = ref<"total" | "remaining">("total");

const isQueueOpen = computed(() =>
  rightPanelStore.isOpen && rightPanelStore.view === "queue",
);

const statusText = computed(() => {
  if (playerStore.sleepTimerRemainingMs > 0) {
    return t("player.sleepTimerScheduledIn", {
      time: formatDuration(playerStore.sleepTimerRemainingMs / 1000),
    });
  }
  return t("player.sleepTimerOff");
});

const remainingText = computed(() =>
  formatDuration(playerStore.sleepTimerRemainingMs / 1000),
);

const pinia = getActivePinia();
const pip = usePictureInPicture();
const queryClient = useQueryClient();

const getPipOptions = () => ({
  component: PIPContent,
  width: 400,
  height: 280,
  plugins: [
    pinia as Pinia,
    i18n,
    { install: (app: App) => app.use(VueQueryPlugin, { queryClient }) },
  ],
});

const handlePipToggle = async () => {
  await pip.toggle(getPipOptions());
};

const handlePreset = (minutes: number) => {
  playerStore.setSleepTimer(minutes * 60 * 1000);
};

const toggleQueuePanel = () => {
  if (isQueueOpen.value) {
    rightPanelStore.close();
    return;
  }

  rightPanelStore.openQueue();
};

const toggleTimeDisplayMode = () => {
  if (playerStore.isLiveStream) return;

  timeDisplayMode.value = timeDisplayMode.value === "total" ? "remaining" : "total";
};

const timeDisplay = computed(() => {
  if (playerStore.isLiveStream) return { current: "🔴", duration: "LIVE" };

  const remainingTime = Math.max(playerStore.duration - playerStore.currentTime, 0);

  return {
    current: timeDisplayMode.value === "remaining"
      ? `-${formatDuration(remainingTime)}`
      : formatDuration(playerStore.currentTime),
    duration: formatDuration(playerStore.duration),
  };
});
</script>
