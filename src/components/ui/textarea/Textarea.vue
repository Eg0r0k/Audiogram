<script setup lang="ts">
import { type HTMLAttributes, nextTick, onBeforeUnmount, onMounted, useAttrs, useTemplateRef, watch } from "vue";

import { useFieldControl } from "@/lib/field-context";
import { cn } from "@/lib/utils";
import { type TextareaSize, type TextareaVariants, textareaVariants } from ".";

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    id?: string;
    defaultValue?: string;
    variant?: TextareaVariants["variant"];
    size?: TextareaSize;
    rows?: number;
    maxrows?: number;
    autoresize?: boolean;
    disabled?: boolean;
    required?: boolean;
    class?: HTMLAttributes["class"];
  }>(),
  { rows: 3, size: "md" },
);

const model = defineModel<string>();
if (model.value === undefined && props.defaultValue !== undefined) model.value = props.defaultValue;

const attrs = useAttrs();
const control = useFieldControl(props, attrs);
const textarea = useTemplateRef<HTMLTextAreaElement>("textarea");

const measure = (element: HTMLTextAreaElement, width: string) => {
  const shadow = element.cloneNode() as HTMLTextAreaElement;
  shadow.removeAttribute("id");
  shadow.removeAttribute("name");
  shadow.setAttribute("aria-hidden", "true");
  shadow.tabIndex = -1;
  shadow.value = element.value;
  Object.assign(shadow.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width,
    height: "",
    minHeight: "0",
    maxHeight: "none",
    overflow: "hidden",
    visibility: "hidden",
    pointerEvents: "none",
  });
  element.after(shadow);
  const height = shadow.scrollHeight;
  shadow.remove();
  return height;
};

const resize = () => {
  const element = textarea.value;
  if (!element) return;
  if (!props.autoresize) {
    element.style.height = "";
    element.style.overflowY = "";
    return;
  }
  if (!element.getClientRects().length) return;

  const style = getComputedStyle(element);
  const frame = Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
  const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  const limit = props.maxrows ? props.maxrows * Number.parseFloat(style.lineHeight) + padding + frame : Infinity;
  const height = measure(element, style.width) + frame;

  element.style.height = `${Math.min(height, limit)}px`;
  element.style.overflowY = height <= limit ? "hidden" : "";
};

let observer: ResizeObserver | undefined;
let width = 0;
onMounted(() => {
  resize();
  observer = new ResizeObserver(([entry]) => {
    if (!entry || entry.contentRect.width === width) return;
    width = entry.contentRect.width;
    requestAnimationFrame(resize);
  });
  if (textarea.value) observer.observe(textarea.value);
});
onBeforeUnmount(() => observer?.disconnect());
watch([model, () => props.autoresize, () => props.rows, () => props.maxrows], () => nextTick(resize));

defineExpose({ resize });
</script>

<template>
  <textarea
    v-bind="attrs"
    :id="control.id.value"
    ref="textarea"
    v-model="model"
    data-slot="textarea"
    :data-variant="props.variant ?? 'outline'"
    :data-size="props.size"
    :rows="props.rows"
    :disabled="control.disabled.value"
    :required="control.required.value"
    :aria-invalid="control.invalid.value"
    :aria-describedby="control.describedBy.value"
    :class="
      cn(textareaVariants({ variant: props.variant, size: props.size }), props.autoresize && 'resize-none', props.class)
    "
  />
</template>
