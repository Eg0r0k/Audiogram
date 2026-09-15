<template>
  <Button
    variant="ghost-primary"
    :class="compact ? 'size-12 rounded-full justify-center' : 'w-full h-12 justify-start px-3'"
    :size="compact ? 'icon' : 'default'"
    :disabled="isStarting"
    :aria-label="$t('queue.myWave')"
    :title="$t('queue.myWave')"
    @click="start()"
  >
    <Spinner
      v-if="isStarting"
      class="size-5"
    />
    <IconWave
      v-else
      class="size-5"
    />
    <span v-if="!compact">{{ isPlayingRadio ? $t("queue.myWavePlaying") : $t("queue.myWave") }}</span>
  </Button>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import IconWave from "~icons/tabler/wave-sine";
import { useYmRadio } from "../composables/useYmRadio";

defineProps<{ compact?: boolean }>();

const { isStarting, isPlayingRadio, start } = useYmRadio();
</script>
