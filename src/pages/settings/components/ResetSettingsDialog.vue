<template>
  <DialogContent class="sm:max-w-sm">
    <DialogHeader>
      <DialogTitle>{{ $t("settings.index.resetAllDialogTitle") }}</DialogTitle>
      <DialogDescription>
        {{ $t("settings.index.resetAllDialogDesc") }}
      </DialogDescription>
    </DialogHeader>

    <DialogFooter>
      <Button
        variant="ghost"
        @click="dismiss"
      >
        {{ $t("common.cancel") }}
      </Button>
      <Button
        variant="ghost"
        color="destructive"
        :disabled="countdown > 0"
        @click="close(true)"
      >
        {{ countdown > 0
          ? $t("settings.index.resetAllConfirmCountdown", { seconds: countdown })
          : $t("settings.index.resetAllConfirm") }}
      </Button>
    </DialogFooter>
  </DialogContent>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialogContext,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const { close, dismiss } = useDialogContext<boolean>();

// The instance is summoned fresh per confirmation, so the countdown simply
// starts at mount — same delayed-confirm pattern as the storage clear dialog.
const COUNTDOWN_SECONDS = 3;
const countdown = ref(COUNTDOWN_SECONDS);
const timer = setInterval(() => {
  countdown.value -= 1;
  if (countdown.value <= 0) clearInterval(timer);
}, 1000);

onBeforeUnmount(() => clearInterval(timer));
</script>
