import { inject, provide, type InjectionKey, type Ref } from "vue";

const DrawerMenuCloseKey: InjectionKey<() => void> = Symbol("DrawerMenuClose");

export interface DrawerMenuSubContext {
  open: Ref<boolean>;
  setOpen: (open: boolean) => void;
}

export const DrawerMenuSubKey: InjectionKey<DrawerMenuSubContext> = Symbol("DrawerMenuSub");

export interface DrawerMenuRadioGroupContext {
  value: () => string | undefined;
  select: (value: string) => void;
}

export const DrawerMenuRadioGroupKey: InjectionKey<DrawerMenuRadioGroupContext> = Symbol("DrawerMenuRadioGroup");

export const provideDrawerMenuClose = (close: () => void): void => {
  provide(DrawerMenuCloseKey, close);
};

export const useDrawerMenuClose = (): (() => void) => {
  const close = inject(DrawerMenuCloseKey);
  if (!close) throw new Error("Drawer menu items must be rendered inside a menu root that provides close");
  return close;
};

export const useDrawerMenuSub = (): DrawerMenuSubContext => {
  const sub = inject(DrawerMenuSubKey);
  if (!sub) throw new Error("DrawerMenuSubTrigger/SubContent must be rendered inside DrawerMenuSub");
  return sub;
};
