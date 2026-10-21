<template>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{{ $t('watchedFolders.removeDialogTitle', { name }) }}</DialogTitle>
      <DialogDescription>
        {{ $t('watchedFolders.removeDialogDescription') }}
      </DialogDescription>
    </DialogHeader>
    <div class="flex justify-end gap-2 pt-2">
      <Button
        variant="ghost"
        @click="dismiss"
      >
        {{ $t('common.cancel') }}
      </Button>
      <Button
        variant="ghost"
        color="destructive"
        @click="close(true)"
      >
        {{ $t('common.delete') }}
      </Button>
    </div>
  </DialogContent>
</template>

<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  useDialogContext,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

defineProps<{
  name: string;
}>();

const { close, dismiss } = useDialogContext<true>();
</script>
