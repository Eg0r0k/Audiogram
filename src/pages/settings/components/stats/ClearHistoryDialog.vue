<template>
  <Dialog
    :open="open"
    @update:open="value => emit('update:open', value)"
  >
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ $t("settings.stats.clearDialogTitle") }}</DialogTitle>
        <DialogDescription>
          {{ $t("settings.stats.clearDialogDesc") }}
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button
          variant="ghost-primary"
          :disabled="pending"
          @click="dismiss"
        >
          {{ $t("common.cancel") }}
        </Button>
        <Button
          variant="destructive"
          :disabled="countdown > 0 || pending"
          @click="confirm"
        >
          {{ countdown > 0
            ? $t("settings.stats.clearConfirmCountdown", { seconds: countdown })
            : $t("settings.stats.clearConfirm") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
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

const props = defineProps<{
  open: boolean;
  /** Runs on confirm; the dialog stays open (pending) until it settles and closes only on success. */
  clear: () => Promise<void>;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
}>();

const { resolve, dismiss } = useSummonedDialog<true>();

const COUNTDOWN_SECONDS = 3;
const countdown = ref(COUNTDOWN_SECONDS);
const pending = ref(false);

// One instance per summon, so the countdown simply starts at mount.
const timer = setInterval(() => {
  countdown.value -= 1;
  if (countdown.value <= 0) clearInterval(timer);
}, 1000);
onBeforeUnmount(() => clearInterval(timer));

const confirm = async () => {
  if (pending.value) return;
  pending.value = true;
  try {
    await props.clear();
    resolve(true);
  }
  catch {
    // The action reported its own failure; leave the dialog open to retry.
    pending.value = false;
  }
};
</script>
