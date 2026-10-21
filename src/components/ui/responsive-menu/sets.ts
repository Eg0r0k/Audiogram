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
  MenuCheckboxItem,
  MenuGroup,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
} from "@/components/ui/menu";
import type { MenuPartSet } from "./context";

export const popperParts: MenuPartSet = {
  Item: MenuItem,
  Separator: MenuSeparator,
  Label: MenuLabel,
  Group: MenuGroup,
  Sub: MenuSub,
  SubTrigger: MenuSubTrigger,
  SubContent: MenuSubContent,
  RadioGroup: MenuRadioGroup,
  RadioItem: MenuRadioItem,
  CheckboxItem: MenuCheckboxItem,
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
