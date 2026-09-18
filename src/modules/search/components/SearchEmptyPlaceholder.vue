<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import IconSearch from "~icons/tabler/search";

withDefaults(defineProps<{
  text?: string;
}>(), {
  text: undefined,
});

const { t } = useI18n();
</script>

<template>
  <Empty>
    <EmptyHeader>
      <EmptyMedia>
        <IconSearch class="size-11 text-muted-foreground" />
      </EmptyMedia>
      <EmptyTitle>{{ text ?? t("search.placeholder") }}</EmptyTitle>
    </EmptyHeader>
  </Empty>
</template>
