<template>
  <Item>
    <ItemMedia>
      <div
        class="flex items-center justify-center"
        :class="statusColor"
      >
        <IconLoader2
          v-if="folder.status === 'scanning'"
          class=" size-6 animate-spin"
        />
        <IconFolder
          v-else-if="folder.status === 'watching'"
          class="size-6"
        />
        <IconAlertTriangle
          v-else-if="folder.status === 'error'"
          class="size-6"
        />
        <IconFolder
          v-else
          class="size-6"
        />
      </div>
    </ItemMedia>
    <ItemContent>
      <ItemTitle>{{ folder.name }}</ItemTitle>
      <ItemSubtitle>
        <template v-if="folder.status === 'scanning'">
          {{ $t('watchedFolders.scanning') }}
        </template>
        <template v-else-if="folder.status === 'error'">
          {{ folder.errorMessage }}
        </template>
        <template v-else>
          {{ folder.fileCount }} {{ $t('watchedFolders.tracks') }}
          <template v-if="folder.lastScanAt">
            · {{ lastScanLabel }}
          </template>
        </template>
      </ItemSubtitle>
    </ItemContent>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          size="icon"
          variant="ghost"
          class="rounded-full"
        >
          <IconDots class="size-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        :side-offset="10"
        class="bg-background/50"
      >
        <DropdownMenuItem
          :disabled="folder.status === 'scanning'"
          @click="$emit('scan', folder)"
        >
          <IconEye class="size-5" />
          {{ $t('watchedFolders.scan') }}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          @click="$emit('remove', folder.id)"
        >
          <IconTrash class=" size-5" />
          {{ $t('watchedFolders.remove') }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </Item>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  Item,
  ItemContent,
  ItemMedia,
  ItemSubtitle,
  ItemTitle,
} from "@/components/ui/item";

import type { WatchedFolder } from "../types";

import IconFolder from "~icons/tabler/folder-filled";
import IconLoader2 from "~icons/tabler/loader-2";
import IconEye from "~icons/tabler/eye";
import IconAlertTriangle from "~icons/tabler/alert-triangle";
import IconDots from "~icons/tabler/dots";
import IconTrash from "~icons/tabler/trash";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const props = defineProps<{
  folder: WatchedFolder;
}>();

defineEmits<{
  scan: [folder: WatchedFolder];
  remove: [id: string];
}>();

const { t } = useI18n();

const statusColor = computed(() => {
  switch (props.folder.status) {
    case "watching": return "";
    case "scanning": return " text-primary";
    case "error": return " text-destructive";
    default: return "text-muted-foreground";
  }
});

const lastScanLabel = computed(() => {
  if (!props.folder.lastScanAt) return "";
  const diff = Date.now() - props.folder.lastScanAt;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t("watchedFolders.justNow");
  if (minutes < 60) return t("watchedFolders.minutesAgo", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("watchedFolders.hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  return t("watchedFolders.daysAgo", { n: days });
});
</script>
