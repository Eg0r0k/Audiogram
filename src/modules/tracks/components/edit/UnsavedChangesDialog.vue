<template>
  <Dialog
    :open="open"
    @update:open="value => emit('update:open', value)"
  >
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ $t("track.edit.unsavedTitle") }}</DialogTitle>
        <DialogDescription>
          {{ $t("track.edit.unsavedDescription") }}
        </DialogDescription>
      </DialogHeader>

      <DialogFooter class="gap-2">
        <Button
          variant="ghost-primary"
          @click="dismiss"
        >
          {{ $t("common.cancel") }}
        </Button>
        <Button
          variant="destructive-link"
          @click="resolve(true)"
        >
          {{ $t("track.edit.discard") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSummonedDialog } from "@/components/dialogs/summon";

defineProps<{ open: boolean }>();

const emit = defineEmits<{
  "update:open": [open: boolean];
}>();

const { resolve, dismiss } = useSummonedDialog<true>();
</script>
