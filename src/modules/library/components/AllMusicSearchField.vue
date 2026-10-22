<template>
  <InputGroup
    variant="soft"
    size="lg"
    class="min-w-0 rounded-full bg-canvas!"
  >
    <InputGroupAddon tabindex="-1">
      <IconSearch class="mr-1 size-5 text-muted-foreground" />
    </InputGroupAddon>

    <InputGroupInput
      ref="inputRef"
      v-model="search"
      class="pl-1! text-base!"
      :placeholder="t('search.mainPlaceholder')"
      @keydown.stop
      @keydown.esc="emit('escape')"
    />

    <InputGroupAddon
      tabindex="-1"
      align="inline-end"
    >
      <InputGroupButton
        v-if="search.trim()"
        color="muted"
        size="icon-sm"
        :aria-label="t('search.noResults.clear')"
        @click="search = ''"
      >
        <IconX class="size-5" />
      </InputGroupButton>

      <TrackSortMenu v-model:sort-key="sortKey" />
    </InputGroupAddon>
  </InputGroup>
</template>

<script setup lang="ts">
import { type ComponentPublicInstance, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import type { TrackSortKey } from "@/modules/tracks/types";
import IconSearch from "~icons/tabler/search";
import IconX from "~icons/tabler/x";
import TrackSortMenu from "./TrackSortMenu.vue";

const search = defineModel<string>("search", { required: true });
const sortKey = defineModel<TrackSortKey | null>("sortKey", { required: true });

const emit = defineEmits<{
  escape: [];
}>();

const { t } = useI18n();

const inputRef = useTemplateRef<ComponentPublicInstance | HTMLInputElement>("inputRef");

defineExpose({
  focus: () => {
    const target = inputRef.value;
    const el = target instanceof HTMLElement ? target : target?.$el;
    const input = el instanceof HTMLInputElement ? el : el?.querySelector?.("input");
    input?.focus();
  },
});
</script>
