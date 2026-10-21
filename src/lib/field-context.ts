import { createContext } from "reka-ui";
import { type Ref, computed, nextTick } from "vue";

export interface FieldContext {
  id: string;
  labelId: string;
  descriptionId: string;
  errorId: string;
  invalid: Ref<boolean>;
  disabled: Ref<boolean>;
  required: Ref<boolean>;
  hasLabel: Ref<boolean>;
  hasDescription: Ref<boolean>;
  hasError: Ref<boolean>;
}

export const [injectFieldContext, provideFieldContext] = createContext<FieldContext>("Field");

type Booleanish = boolean | "true" | "false";

export const useFieldControl = (
  props: { id?: string; disabled?: boolean; required?: boolean },
  attrs: Record<string, unknown>,
) => {
  const field = injectFieldContext(null);

  return {
    field,
    id: computed(() => props.id ?? field?.id),
    disabled: computed(() => props.disabled || field?.disabled.value),
    required: computed(() => props.required || field?.required.value),
    invalid: computed(() => (attrs["aria-invalid"] as Booleanish | undefined) ?? (field?.invalid.value || undefined)),
    labelledBy: computed(
      () =>
        (attrs["aria-labelledby"] as string | undefined)
        ?? (!attrs["aria-label"] && field?.hasLabel.value ? field.labelId : undefined),
    ),
    describedBy: computed(
      () =>
        [
          attrs["aria-describedby"],
          field?.hasDescription.value && field.descriptionId,
          field?.hasError.value && field.errorId,
        ]
          .filter(Boolean)
          .join(" ") || undefined,
    ),
  };
};

const TABBABLE = ["input:not([type=hidden])", "textarea", "select", "button", "[tabindex]"]
  .map(selector => `${selector}:not(:disabled):not([tabindex^="-"])`)
  .join(", ");

const GROUP_ROLES = new Set(["group", "radiogroup"]);

/**
 * Moves focus to the first invalid control inside `root`, in DOM order, once
 * the errors have rendered. For a checkbox or radio group it focuses the box
 * Tab would reach. A control that can't take focus, such as one in a hidden
 * panel, is skipped. Returns the focused element, or null when no invalid
 * control took focus.
 */
export const focusFirstInvalid = async (root: ParentNode | null | undefined, options?: FocusOptions) => {
  await nextTick();
  for (const invalid of Array.from(root?.querySelectorAll<HTMLElement>("[aria-invalid=\"true\"]") ?? [])) {
    // A group's own tab stop hands focus to its checked or first item.
    const isGroup = GROUP_ROLES.has(invalid.getAttribute("role") ?? "");
    const target
      = (isGroup && invalid.querySelector<HTMLElement>(TABBABLE))
        || (invalid.matches(TABBABLE) ? invalid : invalid.querySelector<HTMLElement>(TABBABLE));
    if (!target) continue;
    target.focus({ focusVisible: true, ...options });
    const active = document.activeElement;
    if (active instanceof HTMLElement && invalid.contains(active)) return active;
  }
  return null;
};
