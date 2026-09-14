import {
  ContextMenuCheckboxItem,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from "@/components/ui/context-menu";
import {
  DrawerMenuCheckboxItem,
  DrawerMenuGroup,
  DrawerMenuItem,
  DrawerMenuLabel,
  DrawerMenuRadioGroup,
  DrawerMenuRadioItem,
  DrawerMenuSeparator,
  DrawerMenuSub,
  DrawerMenuSubContent,
  DrawerMenuSubTrigger,
} from "@/components/ui/drawer-menu";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import type { MenuPartSet } from "./context";

export const dropdownParts: MenuPartSet = {
  Item: DropdownMenuItem,
  Separator: DropdownMenuSeparator,
  Label: DropdownMenuLabel,
  Group: DropdownMenuGroup,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  CheckboxItem: DropdownMenuCheckboxItem,
};

export const contextParts: MenuPartSet = {
  Item: ContextMenuItem,
  Separator: ContextMenuSeparator,
  Label: ContextMenuLabel,
  Group: ContextMenuGroup,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
  RadioGroup: ContextMenuRadioGroup,
  RadioItem: ContextMenuRadioItem,
  CheckboxItem: ContextMenuCheckboxItem,
};

export const sheetParts: MenuPartSet = {
  Item: DrawerMenuItem,
  Separator: DrawerMenuSeparator,
  Label: DrawerMenuLabel,
  Group: DrawerMenuGroup,
  Sub: DrawerMenuSub,
  SubTrigger: DrawerMenuSubTrigger,
  SubContent: DrawerMenuSubContent,
  RadioGroup: DrawerMenuRadioGroup,
  RadioItem: DrawerMenuRadioItem,
  CheckboxItem: DrawerMenuCheckboxItem,
};
