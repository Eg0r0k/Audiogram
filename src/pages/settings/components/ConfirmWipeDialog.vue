<template>
  <DialogContent class="sm:max-w-sm">
    <DialogHeader>
      <DialogTitle>{{ title }}</DialogTitle>
      <DialogDescription>
        {{ description }}
      </DialogDescription>
    </DialogHeader>

    <p
      v-if="failed"
      role="alert"
      class="text-sm text-destructive"
    >
      {{ failedText }}
    </p>

    <DialogFooter>
      <Button
        variant="ghost"
        :disabled="pending"
        @click="dismiss"
      >
        {{ $t("common.cancel") }}
      </Button>
      <Button
        variant="ghost"
        color="destructive"
        :disabled="countdown > 0 || pending"
        @click="confirm"
      >
        {{ actionLabel }}
      </Button>
    </DialogFooter>
  </DialogContent>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialogContext,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const props = defineProps<{
  title: string;
  description: string;
  confirmLabel: string;
  failedText: string;
  /** Runs on confirm; the dialog stays open (pending) until it settles and closes only on success. */
  run: () => Promise<void>;
}>();

const { t } = useI18n();
const { close, dismiss, loading: pending } = useDialogContext<true>();

const COUNTDOWN_SECONDS = 3;
const countdown = ref(COUNTDOWN_SECONDS);
const failed = ref(false);

// One instance per summon, so the countdown simply starts at mount.
const timer = setInterval(() => {
  countdown.value -= 1;
  if (countdown.value <= 0) clearInterval(timer);
}, 1000);
onBeforeUnmount(() => clearInterval(timer));

const actionLabel = computed(() => {
  if (countdown.value > 0) return `${props.confirmLabel} (${countdown.value})`;
  return failed.value ? t("common.retry") : props.confirmLabel;
});

const confirm = async () => {
  if (pending.value) return;
  pending.value = true;
  try {
    await props.run();
    close(true);
  }
  catch {
    failed.value = true;
    pending.value = false;
  }
};
</script>
