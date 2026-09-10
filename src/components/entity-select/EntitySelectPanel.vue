<template>
  <div
    class="relative flex h-full w-full flex-col overflow-hidden bg-card"
    :style="keyboardInsetStyle"
  >
    <RightPanelHeader
      :title="title"
      :description="null"
      :show-back="showBack"
      :class="headerClass"
      @back="emit('back')"
      @close="emit('close')"
    />

    <div class="bg-card px-4 pb-2">
      <InputGroup class="flex-1 bg-background! rounded-full">
        <InputGroupInput
          :model-value="search"
          class="pl-3! text-[15px]"
          :placeholder="t('search.placeholder')"
          @keydown.stop
          @update:model-value="emit('update:search', String($event))"
        />
        <InputGroupAddon
          v-if="search.trim()"
          tabindex="-1"
          align="inline-end"
        >
          <Button
            class="rounded-full"
            variant="ghost-primary"
            size="icon-sm"
            @click="emit('update:search', '')"
          >
            <IconX class="size-5" />
          </Button>
        </InputGroupAddon>
      </InputGroup>
    </div>

    <slot name="before-list" />

    <div
      ref="listEl"
      class="relative min-h-0 flex-1 overflow-hidden"
    >
      <VirtualScrollable
        ref="virtualList"
        :items="items"
        :get-item-key="keyAt"
        :item-height="itemHeight"
        :load-more-offset="160"
        :padding-bottom="8 + keyboardInset"
        :loading="isLoading"
        class="h-full"
        @load-more="emit('loadMore')"
      >
        <template #default="{ item, index }">
          <div class="px-2">
            <slot
              name="row"
              :item="item"
              :index="index"
            />
          </div>
        </template>

        <template #empty>
          <slot name="empty">
            <Empty class="p-4 py-8 md:p-4 md:py-8">
              <EmptyDescription>{{ t("common.empty") }}</EmptyDescription>
            </Empty>
          </slot>
        </template>

        <template #loader>
          <slot name="loader" />
        </template>
      </VirtualScrollable>

      <AddFloatingButton
        :count="confirmCount ?? 0"
        :show="showConfirm ?? (confirmCount ?? 0) > 0"
        @click="emit('confirm')"
      />
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { computed, nextTick, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useKeyboardInset } from "@/composables/useKeyboardInset";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import RightPanelHeader from "@/modules/right-panel/components/RightPanelHeader.vue";
import AddFloatingButton from "@/modules/tracks/components/tracks-sheet/AddFloatingButton.vue";
import IconX from "~icons/tabler/x";

const props = withDefaults(defineProps<{
  title: string;
  items: T[];
  getKey: (item: T) => string;
  search: string;
  isLoading?: boolean;
  itemHeight?: number;
  canCreate?: boolean;
  createLabel?: string;
  confirmCount?: number;
  /** Overrides the "count > 0" rule for pickers whose pending change is not a count (a single album, a detach). */
  showConfirm?: boolean;
  showBack?: boolean;
  /** Extra classes for the header row, e.g. to drop its top padding when the host already provides one. */
  headerClass?: string;
  /** Key of the row to scroll into view once it first appears (a picker's current choice). */
  revealKey?: string | null;
}>(), {
  isLoading: false,
  itemHeight: 64,
  canCreate: false,
  createLabel: undefined,
  confirmCount: 0,
  showConfirm: undefined,
  showBack: true,
  headerClass: undefined,
  revealKey: null,
});

const emit = defineEmits<{
  "update:search": [value: string];
  "confirm": [];
  "create": [name: string];
  "loadMore": [];
  "back": [];
  "close": [];
}>();

const { t } = useI18n();

// Searching opens the keyboard; on WebViews that ignore resizes-content the
// confirm button and the list tail would sit behind it. Same pattern as
// EditTrackPanel: the measured overlap feeds --keyboard-inset, which the
// floating button's bottom calc consumes.
const { keyboardInset } = useKeyboardInset();
const keyboardInsetStyle = computed(() => ({ "--keyboard-inset": `${keyboardInset.value}px` }));

const listEl = useTemplateRef<HTMLElement>("listEl");
defineExpose({ listEl });

const virtualList = useTemplateRef<{
  scrollToIndex: (index: number, options?: { align?: "start" | "center" | "end" | "auto" }) => void;
}>("virtualList");

// Reveal happens once, on the first list that holds the row: a later list
// (the user typed a search) must keep the scroll where the user left it.
let revealed = false;
watch(() => props.items, async (items) => {
  if (revealed || !props.revealKey) return;
  const index = items.findIndex(item => props.getKey(item) === props.revealKey);
  if (index === -1) return;
  revealed = true;
  await nextTick();
  virtualList.value?.scrollToIndex(index, { align: "center" });
}, { immediate: true });

const keyAt = (index: number) => {
  const item = props.items[index];
  return item ? props.getKey(item) : index;
};

</script>
