<template>
  <Dialog
    :open="open"
    @update:open="$emit('update:open', $event)"
  >
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ $t("dialogs.deletePlaylist.title") }}</DialogTitle>
      </DialogHeader>

      <div class="flex items-start gap-4 overflow-hidden">
        <div class="size-16 rounded-lg bg-muted overflow-hidden shrink-0">
          <img
            v-if="coverUrl"
            :src="coverUrl"
            :alt="playlist?.name"
            class="size-full object-cover"
          >
          <div
            v-else
            class="size-full flex items-center justify-center"
          >
            <IconPlaylist class="size-6 text-muted-foreground" />
          </div>
        </div>

        <div class="flex-1 min-w-0 overflow-hidden">
          <p class="font-medium truncate w-full">
            {{ playlist?.name }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ $t("common.trackCount", trackCount) }}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="destructive-link"
          :disabled="isDeleting"
          @click="$emit('update:open', false)"
        >
          {{ $t("common.cancel") }}
        </Button>
        <Button
          variant="link"
          :disabled="isDeleting"
          @click="handleDelete"
        >
          {{ $t("common.delete") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PlaylistEntity } from "@/db/entities";
import { storageService } from "@/db/storage";
import IconPlaylist from "~icons/tabler/playlist";

const props = defineProps<{
  open: boolean;
  playlist: PlaylistEntity | null;
  trackCount: number;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "confirm": [];
}>();

const isDeleting = ref(false);
const coverUrl = ref<string | null>(null);

watch(
  () => [props.open, props.playlist] as const,
  async ([isOpen, playlist]) => {
    if (isOpen && playlist?.coverPath) {
      const urlResult = await storageService.getAudioUrl(playlist.coverPath);
      if (urlResult.isOk()) {
        coverUrl.value = urlResult.value;
      }
    }
  },
  { immediate: true },
);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) {
      if (coverUrl.value?.startsWith("blob:")) {
        URL.revokeObjectURL(coverUrl.value);
      }
      coverUrl.value = null;
      isDeleting.value = false;
    }
  },
);

function handleDelete() {
  isDeleting.value = true;
  emit("confirm");
}
</script>
