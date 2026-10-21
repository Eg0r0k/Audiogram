<script setup lang="ts">
import { TabsIndicator, TabsList, type TabsListProps, injectTabsRootContext } from "reka-ui";
import { type HTMLAttributes, computed, nextTick, onBeforeUnmount, onMounted, useTemplateRef, watch } from "vue";

import { cn } from "@/lib/utils";
import { type TabsColor, type TabsListVariants, type TabsSize, tabsIndicatorVariants, tabsListVariants } from ".";

const props = withDefaults(
  defineProps<
    TabsListProps & {
      variant?: NonNullable<TabsListVariants["variant"]>;
      /** The tone of the `line` indicator. The `pill` indicator is a surface and ignores it. */
      color?: TabsColor | (string & {});
      size?: TabsSize;
      class?: HTMLAttributes["class"];
    }
  >(),
  { loop: true, variant: "pill", color: "primary", size: "md" },
);

const delegated = computed(() => {
  const { class: _, variant: __, size: ___, color: ____, ...rest } = props;
  return rest;
});

const list = useTemplateRef<InstanceType<typeof TabsList>>("list");
const indicator = useTemplateRef<InstanceType<typeof TabsIndicator>>("indicator");
let observer: MutationObserver | undefined;

onMounted(() => {
  observer = new MutationObserver(() => indicator.value?.updateIndicatorStyle());
  observer.observe(list.value!.$el, { childList: true, subtree: true });
});

onBeforeUnmount(() => observer?.disconnect());

// Inside a horizontal Scrollable the active tab is brought into view, with
// room for a neighbour on each side.
const SCROLL_MARGIN = 70;
const rootContext = injectTabsRootContext();

const scrollActiveTabIntoView = (tab: HTMLElement) => {
  const scroller = tab.closest<HTMLElement>(".scrollable-x");
  if (!scroller) return;
  const left = tab.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft;
  const right = left + tab.offsetWidth;
  if (left - SCROLL_MARGIN < scroller.scrollLeft) {
    scroller.scrollTo({ left: Math.max(0, left - SCROLL_MARGIN), behavior: "smooth" });
  }
  else if (right + SCROLL_MARGIN > scroller.scrollLeft + scroller.clientWidth) {
    scroller.scrollTo({ left: right + SCROLL_MARGIN - scroller.clientWidth, behavior: "smooth" });
  }
};

watch(() => rootContext.modelValue.value, async () => {
  await nextTick();
  const tab = list.value?.$el?.querySelector?.("[role=\"tab\"][data-state=\"active\"]");
  if (tab instanceof HTMLElement) scrollActiveTabIntoView(tab);
});
</script>

<template>
  <TabsList
    ref="list"
    v-bind="delegated"
    data-slot="tabs-list"
    :data-variant="props.variant"
    :data-color="props.color"
    :data-size="props.size"
    :class="cn(tabsListVariants({ variant: props.variant, size: props.size }), props.class)"
  >
    <slot />
    <TabsIndicator
      ref="indicator"
      data-slot="tabs-indicator"
      :class="tabsIndicatorVariants({ variant: props.variant })"
    />
  </TabsList>
</template>
