import { cva } from "class-variance-authority";
import { createContext } from "reka-ui";
import type { Ref } from "vue";

export { default as Editable } from "./Editable.vue";
export { default as EditableArea } from "./EditableArea.vue";
export { default as EditableInput } from "./EditableInput.vue";
export { default as EditablePreview } from "./EditablePreview.vue";

export interface EditableContext {
  autoResize: Ref<boolean>;
}

export const [injectEditableContext, provideEditableContext] = createContext<EditableContext>("Editable");

export const editableAreaVariants = cva(
  `
    group/editable-area -mx-1.5 min-w-0 rounded-control-sm px-1.5 transition-colors duration-short-3 ease-standard
    hover:bg-muted
    data-focus:bg-background data-focus:focus-ring
    data-readonly:bg-transparent
    data-disabled:bg-transparent data-disabled:opacity-(--disabled-opacity)
    cursor-text
    data-focus:cursor-auto
    data-readonly:cursor-default
    data-disabled:cursor-not-allowed
    motion-reduce:transition-none
  `,
  {
    variants: {
      autoResize: { true: "inline-grid", false: "" },
    },
  },
);

export const editablePreviewVariants = cva("in-data-empty:text-muted-foreground", {
  variants: {
    autoResize: {
      true: `
        [grid-area:1/1] overflow-hidden text-ellipsis whitespace-pre select-none
        group-data-focus/editable-area:invisible
      `,
      false: "",
    },
  },
});

export const editableInputVariants = cva(
  `
    w-full min-w-0 bg-transparent tracking-[inherit] text-inherit outline-none field-sizing-content
    placeholder:text-muted-foreground
    selection:bg-primary selection:text-primary-foreground
  `,
  {
    variants: {
      autoResize: {
        true: "invisible [grid-area:1/1] group-data-focus/editable-area:visible",
        false: "",
      },
    },
  },
);
