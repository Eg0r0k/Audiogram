<script setup lang="ts">
import { useI18n } from "vue-i18n";
import IconSearchOff from "~icons/tabler/search-off";

defineProps<{
  query: string;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
    <div class="size-12 rounded-full bg-muted flex items-center justify-center">
      <IconSearchOff class="size-5 text-muted-foreground" />
    </div>
    <div>
      <p class="font-medium mb-1">
        {{ t("search.noResults.title", { query }) }}
      </p>
      <p class="text-sm text-muted-foreground">
        {{ t("search.noResults.hint") }}
      </p>
    </div>
  </div>
</template>
