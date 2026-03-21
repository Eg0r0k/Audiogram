<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="flex flex-wrap gap-2">
      <Button
        as-child
        variant="ghost-primary"
      >
        <Link to="/profile">
          Profile
        </Link>
      </Button>

      <Button
        as-child
        variant="ghost-primary"
      >
        <Link to="/library">
          Lib
        </Link>
      </Button>

      <!-- <div class="w-full text-xs font-mono bg-muted p-3 rounded-md space-y-1">
        <div class="flex justify-between">
          <span class="text-muted-foreground">Status:</span>
          <Badge :variant="statusVariant">
            {{ playerStore.status }}A
          </Badge>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Current Track:</span>
          <span class="truncate max-w-[200px]">
            {{ playerStore.currentTrack?.title ?? "—" }}
          </span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Duration:</span>
          <span>{{ formatDuration(playerStore.duration) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Current Time:</span>
          <span>{{ formatDuration(playerStore.currentTime) }}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Progress:</span>
          <span>{{ playerStore.progress.toFixed(1) }}%</span>
        </div>
        <div class="flex justify-between">
          <span class="text-muted-foreground">Live Stream:</span>
          <span>{{ playerStore.isLiveStream ? "Yes" : "No" }}</span>
        </div>
      </div> -->
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from "vue";
import { usePlayerStore } from "@/modules/player/store/player.store";

// Components
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import Link from "@/components/ui/link/Link.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { formatDuration } from "@/lib/format/time";
import { LocalTrack } from "@/modules/player/types";
import AlbumContext from "@/components/media-hero/menu/contexts/AlbumContext.vue";

const playerStore = usePlayerStore();

const activeTab = ref("library");
const streamUrl = ref("");
const directUrl = ref("");

// Track delete dialog states
const deleteDialogOpen = reactive<Record<string, boolean>>({});

const demoStreams = [
  {
    name: "Mux HLS",
    url: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  },
  {
    name: "Apple HLS Basic",
    url: "https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8",
  },
];

const demoAudioUrls = [
  {
    name: "OGG Sample",
    url: "https://upload.wikimedia.org/wikipedia/commons/c/c8/Example.ogg",
  },
  {
    name: "MP3 T-Rex",
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3",
  },
];

const statusVariant = computed(() => {
  switch (playerStore.status) {
    case "playing":
      return "default";
    case "paused":
      return "secondary";
    case "loading":
      return "outline";
    case "error":
      return "destructive";
    default:
      return "secondary";
  }
});

const isCurrentTrack = (track: LocalTrack): boolean => {
  return playerStore.currentTrack?.id === track.id;
};

const loadUrl = () => {
  if (streamUrl.value) {
    playerStore.playUrl(streamUrl.value);
  }
};

const loadDemo = (url: string) => {
  streamUrl.value = url;
  playerStore.playUrl(url);
};

const loadDirectUrl = () => {
  if (directUrl.value) {
    playerStore.playUrl(directUrl.value);
  }
};

const loadDirectDemo = (url: string) => {
  directUrl.value = url;
  playerStore.playUrl(url);
};
</script>
