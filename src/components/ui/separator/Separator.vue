<script setup lang="ts">
import { Separator, type SeparatorProps } from "reka-ui";
import { type HTMLAttributes, computed, useSlots } from "vue";

import { cn } from "@/lib/utils";
import { type SeparatorSize, separatorVariants } from ".";

const props = withDefaults(
  defineProps<
    SeparatorProps & {
      label?: string;
      size?: SeparatorSize;
      class?: HTMLAttributes["class"];
    }
  >(),
  { orientation: "horizontal", decorative: true, size: "xs" },
);

const slots = useSlots();

const delegated = computed(() => {
  const { class: _, label: __, size: ___, ...rest } = props;
  return rest;
});

const labelled = () => Boolean(props.label || slots.default);

const shape = {
  horizontal: { line: "h-(--separator-size) w-full", labelled: "w-full" },
  vertical: { line: "h-full w-(--separator-size)", labelled: "h-full flex-col" },
};

const line = `
  bg-border
  group-data-[orientation=horizontal]/separator:h-(--separator-size)
  group-data-[orientation=vertical]/separator:w-(--separator-size)
`;
</script>

<template>
  <Separator
    v-bind="delegated"
    data-slot="separator"
    :data-size="props.size"
    :class="
      cn(
        separatorVariants({ size: props.size }),
        labelled()
          ? ['flex items-center gap-3', shape[props.orientation].labelled]
          : ['bg-border', shape[props.orientation].line],
        props.class,
      )
    "
  >
    <template v-if="labelled()">
      <span
        data-slot="separator-line"
        :class="cn(line, 'flex-1')"
      />
      <span
        data-slot="separator-label"
        class="shrink-0 text-label-md text-muted-foreground"
      >
        <slot>{{ props.label }}</slot>
      </span>
      <span
        data-slot="separator-line"
        :class="cn(line, 'flex-1')"
      />
    </template>
  </Separator>
</template>
