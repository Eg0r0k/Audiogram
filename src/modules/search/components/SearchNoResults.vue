<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import IconSearchOff from "~icons/tabler/search-off";
import IconX from "~icons/tabler/x";
import EmptyContent from "@/components/ui/empty/EmptyContent.vue";
import { Button } from "@/components/ui/button";

defineProps<{
  query: string;
}>();

const emit = defineEmits<{
  clear: [];
}>();

const { t } = useI18n();
</script>

<template>
  <Empty>
    <EmptyHeader>
      <EmptyMedia>
        <IconSearchOff class="size-11 text-muted-foreground" />
      </EmptyMedia>
      <EmptyTitle>
        {{ t("search.noResults.title", { query }) }}
      </EmptyTitle>
      <EmptyDescription>
        {{ t("search.noResults.hint") }}
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      <Button
        variant="outline"
        @click="emit('clear')"
      >
        <IconX />
        {{ t("search.noResults.clear") }}
      </Button>
    </EmptyContent>
  </Empty>
</template>
