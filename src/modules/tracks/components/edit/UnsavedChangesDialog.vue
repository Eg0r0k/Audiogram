<template>
  <DialogContent class="sm:max-w-sm">
    <DialogHeader>
      <DialogTitle>{{ $t("track.edit.unsavedTitle") }}</DialogTitle>
      <DialogDescription>
        {{ $t("track.edit.unsavedDescription") }}
      </DialogDescription>
    </DialogHeader>

    <DialogFooter class="gap-2">
      <Button
        variant="ghost"
        @click="dismiss"
      >
        {{ $t("common.cancel") }}
      </Button>
      <Button
        variant="ghost"
        color="destructive"
        @click="close(true)"
      >
        {{ $t("track.edit.discard") }}
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
