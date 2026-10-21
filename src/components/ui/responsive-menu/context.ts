import type { Component, ComputedRef, InjectionKey, ShallowRef } from "vue";
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

/** The popper surface's imperative API, registered by the content in popper mode. */
export interface PopperMenuHandle {
  show: (event?: Event) => void;
  hide: () => void;
}

export interface ResponsiveMenuContext {
  kind: ResponsiveMenuKind;
  mode: ComputedRef<ResponsiveMenuMode>;
  parts: ComputedRef<MenuPartSet>;
  isOpen: ComputedRef<boolean>;
  setOpen: (open: boolean) => void;
  modal: ComputedRef<boolean>;
  /** The element the popper menu attaches to, registered by the trigger. */
  trigger: ShallowRef<HTMLElement | null>;
  triggerDisabled: ShallowRef<boolean>;
  popper: ShallowRef<PopperMenuHandle | null>;
}

const ResponsiveMenuKey: InjectionKey<ResponsiveMenuContext> = Symbol("ResponsiveMenu");

export const provideResponsiveMenu = (context: ResponsiveMenuContext): void => {
  provide(ResponsiveMenuKey, context);
};

/** The enclosing responsive menu, or null outside one. */
export const injectResponsiveMenu = (): ResponsiveMenuContext | null => inject(ResponsiveMenuKey, null);

export const useResponsiveMenu = (): ResponsiveMenuContext => {
  const context = inject(ResponsiveMenuKey);
  if (!context) throw new Error("Responsive menu parts must be rendered inside ResponsiveMenu or ResponsiveContextMenu");
  return context;
};
