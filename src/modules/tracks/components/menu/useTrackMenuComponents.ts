import { inject, provide, type Component, type InjectionKey } from "vue";
import {
  ResponsiveMenuItem,
  ResponsiveMenuSeparator,
  ResponsiveMenuSub,
  ResponsiveMenuSubContent,
  ResponsiveMenuSubTrigger,
} from "@/components/ui/responsive-menu";

export interface MenuTrackComponents {
  Item: Component;
  Separator: Component;
  Sub: Component;
  SubTrigger: Component;
  SubContent: Component;
}

const TrackMenuComponentsKey: InjectionKey<MenuTrackComponents> = Symbol("MenuTrackComponents");

export const responsiveTrackComponents: MenuTrackComponents = {
  Item: ResponsiveMenuItem,
  Separator: ResponsiveMenuSeparator,
  Sub: ResponsiveMenuSub,
  SubTrigger: ResponsiveMenuSubTrigger,
  SubContent: ResponsiveMenuSubContent,
};

export function provideTrackMenuComponents(components: MenuTrackComponents) {
  provide(TrackMenuComponentsKey, components);
}

export function useTrackMenuComponents(): MenuTrackComponents {
  const components = inject(TrackMenuComponentsKey);
  if (!components) {
    throw new Error("useTrackMenuComponents must be used within a menu provider");
  }
  return components;
}
