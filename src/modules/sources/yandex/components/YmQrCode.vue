<template>
  <!-- The box is the caller's: its size and padding classes land here and
       the image fills it. On the img they fought size-full and lost. -->
  <div class="overflow-hidden">
    <img
      v-if="qrcode"
      :src="qrcode"
      :alt="value"
      class="block size-full"
    >
  </div>
</template>

<script setup lang="ts">
import { toRef } from "vue";
import { useQRCode } from "@vueuse/integrations/useQRCode";

const props = defineProps<{ value: string }>();

// The rendition is a PNG data URL; the wrapper's white box keeps it scannable
// on a dark theme regardless of the current text colour.
const qrcode = useQRCode(toRef(props, "value"), { margin: 1, errorCorrectionLevel: "M", width: 256 });
</script>
