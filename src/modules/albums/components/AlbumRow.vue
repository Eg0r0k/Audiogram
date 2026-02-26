<template>
  <div
    v-ripple
    class="flex select-none flex-col p-3 gap-2  rounded-sm text-pretty min-w-36 w-full"
  >
    <div class="z-1 relative shrink-0 overflow-hidden">
      <NuxtImage
        :placeholder="true"
        class=" object-cover w-full rounded-sm"
        fallback-src="/img/fallback.svg"
      />
    </div>
    <div>
      <span class=" font-semibold">
        Хиты FM
      </span>
    </div>
  </div>
</template>
<script lang="ts" setup>
import NuxtImage from "@/components/ui/image/NuxtImage.vue";

</script>
