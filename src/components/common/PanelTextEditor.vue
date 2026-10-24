<template>
  <div class="flex min-h-0 flex-1 flex-col pb-[calc(1rem+var(--keyboard-inset,0px)+var(--mobile-bottom-inset,0px))]">
    <Scrollable
      ref="scrollArea"
      class="min-h-0 flex-1"
    >
      <div class="flex min-h-full flex-col px-5 pt-2">
        <Textarea
          v-bind="$attrs"
          v-model="text"
          variant="soft"
          autoresize
          :class="cn('grow resize-none text-sm', props.fieldClass)"
          :placeholder="props.placeholder"
          :aria-label="props.label"
          :disabled="props.disabled"
          @input="scheduleCaretReveal"
        />
      </div>
    </Scrollable>
    <p class="mt-3 flex h-12 shrink-0 items-center gap-3 pr-19 pl-5 text-xs text-muted-foreground">
      <slot name="status" />
    </p>
  </div>

  <FloatingActionButton :show="props.showSave">
    <Button
      type="button"
      class="size-12 rounded-full shadow-lg"
      :aria-label="props.saveLabel"
      :disabled="props.saveDisabled"
      @click="emit('save')"
    >
      <IconSave class="size-6" />
    </Button>
  </FloatingActionButton>
</template>

<script setup lang="ts">
import { type HTMLAttributes, onBeforeUnmount, useTemplateRef } from "vue";
import FloatingActionButton from "@/components/common/FloatingActionButton.vue";
import { Button } from "@/components/ui/button";
import { Scrollable } from "@/components/ui/scrollable";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import IconSave from "~icons/tabler/device-floppy";

defineOptions({ inheritAttrs: false });

// Two roots on purpose: the save button must land in the panel root, outside
// anything that scrolls, or its hidden translate becomes scrollable overflow.
const props = defineProps<{
  label: string;
  saveLabel: string;
  showSave: boolean;
  saveDisabled?: boolean;
  placeholder?: string;
  disabled?: boolean;
  fieldClass?: HTMLAttributes["class"];
}>();

const emit = defineEmits<{
  save: [];
}>();

const text = defineModel<string>({ required: true });

const scrollArea = useTemplateRef<InstanceType<typeof Scrollable>>("scrollArea");

const caretBottom = (field: HTMLTextAreaElement) => {
  const end = field.selectionEnd;
  const mirror = field.cloneNode() as HTMLTextAreaElement;
  mirror.removeAttribute("id");
  mirror.setAttribute("aria-hidden", "true");
  mirror.tabIndex = -1;
  mirror.value = field.value.slice(0, end + field.value.slice(end).search(/\s|$/));
  Object.assign(mirror.style, {
    position: "absolute",
    width: getComputedStyle(field).width,
    height: "0",
    minHeight: "0",
    visibility: "hidden",
    pointerEvents: "none",
  });
  field.after(mirror);
  const bottom = field.clientTop + mirror.scrollHeight;
  mirror.remove();
  return bottom;
};

const revealCaret = (field: HTMLTextAreaElement) => {
  const area = scrollArea.value;
  const container = area?.container;
  if (!area || !container) return;
  const fieldTop = field.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  const below = fieldTop + caretBottom(field) - container.scrollTop - container.clientHeight;
  if (below > 0) area.scrollTo({ position: container.scrollTop + below, behavior: "instant" });
};

// Autoresize grows the field after the browser has scrolled to the caret, which can leave it below the view.
let revealFrame: number | null = null;
const scheduleCaretReveal = (event: Event) => {
  const field = event.target;
  if (!(field instanceof HTMLTextAreaElement) || revealFrame !== null) return;
  revealFrame = requestAnimationFrame(() => {
    revealFrame = null;
    revealCaret(field);
  });
};
onBeforeUnmount(() => {
  if (revealFrame !== null) cancelAnimationFrame(revealFrame);
});
</script>
