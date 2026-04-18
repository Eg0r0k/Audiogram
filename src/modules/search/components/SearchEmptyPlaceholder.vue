<script setup lang="ts">
import { useI18n } from "vue-i18n";
import IconSearch from "~icons/tabler/search";

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col  items-center justify-center py-8 gap-3 px-6 text-center">
    <div class=" flex items-center justify-center">
      <IconSearch class="size-20 text-muted-foreground" />
    </div>
    <p class="text-lg font-semibold">
      {{ t("search.placeholder") }}
    </p>
  </div>
</template>
