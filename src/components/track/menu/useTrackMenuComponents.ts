import { inject, provide, type Component, type InjectionKey } from "vue";
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "@/components/ui/context-menu";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

export interface MenuTrackComponents {
  Item: Component;
  Separator: Component;
  Sub: Component;
  SubTrigger: Component;
  SubContent: Component;
}

const TrackMenuComponentsKey: InjectionKey<MenuTrackComponents> = Symbol("MenuTrackComponents");

export const contextMenuTrackComponents: MenuTrackComponents = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,

};

export const dropdownMenuTrackComponents: MenuTrackComponents = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
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
