<template>
  <DialogContent class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>{{ $t("common.import.status.cancelTitle") }}</DialogTitle>
      <DialogDescription>{{ $t("common.import.status.cancelDescription") }}</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button
        variant="ghost"
        @click="dismiss"
      >
        {{ $t("common.import.status.continueImport") }}
      </Button>
      <Button
        variant="ghost"
        color="destructive"
        @click="close(true)"
      >
        {{ $t("common.import.status.confirmCancel") }}
      </Button>
    </DialogFooter>
  </DialogContent>
</template>

<script setup lang="ts">
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialogContext,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const { close, dismiss } = useDialogContext<true>();
</script>
