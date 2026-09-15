import { inject, provide, type Component, type InjectionKey } from "vue";
import { ResponsiveMenuItem, ResponsiveMenuSeparator } from "@/components/ui/responsive-menu";

export interface MenuComponents {
  Item: Component;
  Separator: Component;
}

const MenuComponentsKey: InjectionKey<MenuComponents> = Symbol("MenuComponents");

export const responsiveMenuComponents: MenuComponents = {
  Item: ResponsiveMenuItem,
  Separator: ResponsiveMenuSeparator,
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
