<template>
  <Dialog
    :open="open"
    @update:open="$emit('update:open', $event)"
  >
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ $t("dialogs.editAlbum.delete.title") }}</DialogTitle>
      </DialogHeader>

      <div class="flex items-start gap-4 overflow-hidden">
        <div class="flex-1 min-w-0 overflow-hidden">
          <p class="font-medium truncate w-full">
            {{ album?.title }}
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

const props = defineProps<{
  open: boolean;
  album: AlbumEntity | null;
  trackCount: number;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "confirm": [];
}>();

const isDeleting = ref(false);

function handleDelete() {
  isDeleting.value = true;
  emit("confirm");
}
</script>
