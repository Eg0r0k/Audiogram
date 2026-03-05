<template>
  <Dialog
    :open="open"
    @update:open="$emit('update:open', $event)"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t("dialogs.deleteAlbum.title") }}</DialogTitle>
      </DialogHeader>

      <div class="flex items-center gap-4 ">
        <div class="size-16 rounded-lg bg-muted overflow-hidden  shrink-0">
          <img
            v-if="album?.coverPath"
            :src="album.coverPath"
            :alt="album.title"
            class="size-full object-cover"
          >
        </div>
        <div class="flex-1 min-w-0">
          <p class="font-medium truncate">
            {{ album?.title }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ trackCount }} {{ $t("common.tracks", trackCount) }}
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
          <IconLoader2
            v-if="isDeleting"
            class="size-4 animate-spin"
          />
          {{ $t("common.delete") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AlbumEntity } from "@/db/entities";
import IconLoader2 from "~icons/tabler/loader-2";

defineProps<{
  open: boolean;
  album: AlbumEntity | null;
  trackCount: number;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "confirm": [];
}>();

const isDeleting = ref(false);

async function handleDelete() {
  isDeleting.value = true;
  emit("confirm");
}
</script>
