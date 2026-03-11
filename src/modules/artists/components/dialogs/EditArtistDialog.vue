<template>
  <Dialog
    :open="open"
    @update:open="$emit('update:open', $event)"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t("dialogs.editAlbum.title") }}</DialogTitle>
      </DialogHeader>

      <DialogFooter>
        <Button
          variant="destructive-link"
          :disabled="isSaving"
          @click="$emit('update:open', false)"
        >
          {{ $t("common.cancel") }}
        </Button>
        <Button
          variant="link"
          :disabled="isSaving "
        >
          <IconLoader2
            v-if="isSaving"
            class="size-4 animate-spin"
          />
          {{ $t("common.save") }}
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

const props = defineProps<{
  open: boolean;
  album: AlbumEntity | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  "save": [changes: Partial<AlbumEntity>];
}>();

const form = ref({
  title: "",
  year: undefined as number | undefined,
});

const isSaving = ref(false);

</script>
