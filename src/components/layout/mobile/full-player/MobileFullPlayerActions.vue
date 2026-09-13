<template>
  <div class="flex items-center justify-between mt-6 px-1 landscape-short:mt-3">
    <Button
      v-if="libraryTrack"
      size="icon"
      variant="ghost"
      :class="{ 'text-primary': isChaptersOpen }"
      :aria-label="$t('player.chapters')"
      @click.stop="toggleChapters"
    >
      <IconBookmarks class="size-6" />
    </Button>
    <Button
      v-if="libraryTrack"
      size="icon"
      variant="ghost"
      :class="{ 'text-primary': isLyricsOpen }"
      :aria-label="$t('player.lyrics')"
      @click.stop="toggleLyrics"
    >
      <IconMicrophone2 class="size-6" />
    </Button>
    <Button
      size="icon"
      variant="ghost"
      :class="{ 'text-primary': isQueueOpen }"
      :aria-label="$t('player.queue')"
      @click.stop="toggleQueue"
    >
      <IconPlaylist class="size-6" />
    </Button>
    <ResponsiveMenu>
      <ResponsiveMenuTrigger>
        <Button
          size="icon"
          variant="ghost"
          :aria-label="statusText"
          @click.stop
        >
          <IconMoonStars
            class="size-6"
            :class="isSleepTimerActive ? 'text-primary' : ''"
          />
        </Button>
      </ResponsiveMenuTrigger>
      <ResponsiveMenuContent
        align="end"
        class="w-52"
      >
        <ResponsiveMenuLabel class="text-xs text-muted-foreground font-medium">
          {{ statusText }}
        </ResponsiveMenuLabel>
        <ResponsiveMenuItem
          v-for="preset in presets"
          :key="preset.minutes"
          @click="setTimer(preset.minutes)"
        >
          <IconClockHour4 class="size-5" />
          {{ $t("common.minutesShort", { count: preset.minutes }) }}
        </ResponsiveMenuItem>
        <template v-if="isSleepTimerActive">
          <ResponsiveMenuSeparator />
          <ResponsiveMenuItem
            variant="destructive"
            @click="cancelSleepTimer()"
          >
            <IconPlayerStop class="size-5" />
            {{ $t("player.cancelSleepTimer") }}
          </ResponsiveMenuItem>
        </template>
      </ResponsiveMenuContent>
    </ResponsiveMenu>
  </div>
</template>
<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuLabel,
  ResponsiveMenuSeparator,
  ResponsiveMenuTrigger,
} from "@/components/ui/responsive-menu";
import { useCurrentPlayerTrack } from "@/modules/player/composables/useCurrentPlayerTrack";
import { useSleepTimer } from "@/modules/player/composables/useSleepTimer";
import { useCurrentTrackPanels } from "@/modules/right-panel/composables/useCurrentTrackPanels";

import IconBookmarks from "~icons/tabler/bookmarks";
import IconMicrophone2 from "~icons/tabler/microphone-2";
import IconPlaylist from "~icons/tabler/playlist";
import IconMoonStars from "~icons/tabler/moon-stars";
import IconClockHour4 from "~icons/tabler/clock-hour-4";
import IconPlayerStop from "~icons/tabler/circle-minus";

const { libraryTrack } = useCurrentPlayerTrack();
const {
  isChaptersOpen,
  toggleChapters,
  isLyricsOpen,
  toggleLyrics,
  isQueueOpen,
  toggleQueue,
} = useCurrentTrackPanels();

const {
  presets,
  isActive: isSleepTimerActive,
  statusText,
  setTimer,
  cancel: cancelSleepTimer,
} = useSleepTimer();
</script>
