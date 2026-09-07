<template>
  <Dialog
    :open="open"
    @update:open="value => emit('update:open', value)"
  >
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{{ $t('watchedFolders.removeDialogTitle') }}</DialogTitle>
        <DialogDescription>
          {{ $t('watchedFolders.removeDialogDescription', { name }) }}
        </DialogDescription>
      </DialogHeader>
      <div class="flex justify-end gap-2 pt-2">
        <Button
          variant="ghost-primary"
          @click="dismiss"
        >
          {{ $t('common.cancel') }}
        </Button>
        <Button
          variant="destructive-link"
          @click="resolve(true)"
        >
          {{ $t('common.delete') }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSummonedDialog } from "@/components/dialogs/summon";

defineProps<{
  open: boolean;
  name: string;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
}>();

const { resolve, dismiss } = useSummonedDialog<true>();
</script>
