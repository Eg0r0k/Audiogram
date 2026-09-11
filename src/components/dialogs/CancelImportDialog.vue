<template>
  <Dialog
    :open="open"
    @update:open="value => emit('update:open', value)"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t("common.import.status.cancelTitle") }}</DialogTitle>
        <DialogDescription>{{ $t("common.import.status.cancelDescription") }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button
          variant="ghost-primary"
          @click="dismiss"
        >
          {{ $t("common.import.status.continueImport") }}
        </Button>
        <Button
          variant="destructive-link"
          @click="resolve(true)"
        >
          {{ $t("common.import.status.confirmCancel") }}
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
