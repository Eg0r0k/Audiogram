<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { Button } from "@/components/ui/button";
import IconHistory from "~icons/tabler/history";
import IconLink from "~icons/tabler/link";
import IconX from "~icons/tabler/x";
import { sources } from "@/modules/sources";
import { cleanQueryUrl, recentQueryUrl } from "../lib/recentQuery";

const props = defineProps<{
  items: readonly string[];
}>();

const emit = defineEmits<{
  apply: [item: string];
  remove: [item: string];
  clear: [];
}>();

const { t } = useI18n();

// A source that can open the link names it best (youtu.be/ID keeps the id a
// generic cleanup would drop with the query); anything else is just tidied.
const linkLabel = (url: URL): string => {
  for (const provider of sources.all()) {
    const label = provider.shortLink?.(url);
    if (label) return label;
  }
  return cleanQueryUrl(url);
};

const rows = computed(() =>
  props.items.map((item) => {
    const url = recentQueryUrl(item);
    return { item, isLink: url !== null, label: url ? linkLabel(url) : item };
  }),
);
</script>

<template>
  <div class="flex flex-col gap-2 mt-2">
    <div class="flex items-center justify-between gap-2">
      <p class="text-sm font-medium text-muted-foreground">
        {{ t("search.recentTitle") }}
      </p>
      <Button
        variant="ghost"
        color="muted"
        size="sm"
        class="rounded-full"
        @click="emit('clear')"
      >
        {{ t("search.clear") }}
      </Button>
    </div>

    <div
      v-for="row in rows"
      :key="row.item"
      v-ripple
      class="flex items-center select-none gap-3 rounded-md px-2.5 py-1.5 text-left hover:bg-muted/50"
      role="button"
      tabindex="0"
      :title="row.isLink ? row.item : undefined"
      @click="emit('apply', row.item)"
      @keypress.enter="emit('apply', row.item)"
    >
      <component
        :is="row.isLink ? IconLink : IconHistory"
        class="size-5 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span class="min-w-0 flex-1 truncate text-sm">{{ row.label }}</span>
      <Button
        variant="ghost"
        color="muted"
        size="icon-sm"
        class="shrink-0 rounded-full"
        :aria-label="t('common.remove')"
        :title="t('common.remove')"
        @click.stop="emit('remove', row.item)"
        @keypress.enter.stop
      >
        <IconX />
      </Button>
    </div>
  </div>
</template>
