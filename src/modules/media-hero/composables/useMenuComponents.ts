import { inject, provide, type Component, type InjectionKey } from "vue";
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface MenuComponents {
  Item: Component;
  Separator: Component;
}

const MenuComponentsKey: InjectionKey<MenuComponents> = Symbol("MenuComponents");

export const contextMenuComponents: MenuComponents = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
};

export const dropdownMenuComponents: MenuComponents = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
};

export function provideMenuComponents(components: MenuComponents) {
  provide(MenuComponentsKey, components);
}

export function useMenuComponents(): MenuComponents {
  const components = inject(MenuComponentsKey);
  if (!components) {
    throw new Error("useMenuComponents must be used within a menu provider");
  }
  return components;
}
