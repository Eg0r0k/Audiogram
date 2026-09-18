<template>
  <div class="flex h-full min-h-0 flex-col bg-card">
    <RightPanelHeader
      :title="$t('player.lyrics')"
      :description="playerStore.currentTrack?.title"
      :show-back="rightPanel.depth > 0"
      @back="rightPanel.back()"
      @close="rightPanel.close()"
    >
      <template #trailing>
        <Button
          v-if="attachableTrack"
          variant="ghost"
          size="icon"
          class="shrink-0 rounded-full"
          :aria-label="attachLabel"
          :disabled="isAttachingLyrics"
          @click="attachLyrics"
        >
          <IconFileMusic
            class="size-6"
            :class="{ 'animate-pulse': isAttachingLyrics }"
          />
        </Button>
      </template>
    </RightPanelHeader>

    <Scrollable class="min-h-0 flex-1">
      <div class="px-2 pb-8 pt-2 h-full">
        <CurrentTrackLyrics variant="panel" />
      </div>
    </Scrollable>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Scrollable } from "@/components/ui/scrollable";
import IconFileMusic from "~icons/tabler/file-music";
import CurrentTrackLyrics from "@/modules/player/components/CurrentTrackLyrics.vue";
import { useAttachCurrentTrackLyrics } from "@/modules/player/composables/useAttachCurrentTrackLyrics";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import RightPanelHeader from "@/modules/right-panel/components/RightPanelHeader.vue";

const playerStore = usePlayerStore();
const rightPanel = useRightPanelStore();
const { attachableTrack, attachLabel, isAttachingLyrics, attachLyrics } = useAttachCurrentTrackLyrics();
</script>
