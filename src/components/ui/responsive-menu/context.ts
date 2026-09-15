import type { Component, ComputedRef, InjectionKey } from "vue";
import { inject, provide } from "vue";

export type ResponsiveMenuMode = "popper" | "sheet";
export type ResponsiveMenuKind = "dropdown" | "context";

/** Menu parts a consumer composes; each mode maps them to real components. */
export interface MenuPartSet {
  Item: Component;
  Separator: Component;
  Label: Component;
  Group: Component;
  Sub: Component;
  SubTrigger: Component;
  SubContent: Component;
  RadioGroup: Component;
  RadioItem: Component;
  CheckboxItem: Component;
}

export interface ResponsiveMenuContext {
  kind: ResponsiveMenuKind;
  mode: ComputedRef<ResponsiveMenuMode>;
  parts: ComputedRef<MenuPartSet>;
  isOpen: ComputedRef<boolean>;
  setOpen: (open: boolean) => void;
}

const ResponsiveMenuKey: InjectionKey<ResponsiveMenuContext> = Symbol("ResponsiveMenu");

export const provideResponsiveMenu = (context: ResponsiveMenuContext): void => {
  provide(ResponsiveMenuKey, context);
};

export const useResponsiveMenu = (): ResponsiveMenuContext => {
  const context = inject(ResponsiveMenuKey);
  if (!context) throw new Error("Responsive menu parts must be rendered inside ResponsiveMenu or ResponsiveContextMenu");
  return context;
};
