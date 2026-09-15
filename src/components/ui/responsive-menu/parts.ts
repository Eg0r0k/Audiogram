import { defineComponent, h } from "vue";
import { useResponsiveMenu, type MenuPartSet } from "./context";

// Every part is the same thin shell: pick the real component for the current
// mode and hand it the attrs, listeners and slots untouched.
const createPart = (name: keyof MenuPartSet) =>
  defineComponent({
    name: `ResponsiveMenu${name}`,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      const menu = useResponsiveMenu();
      return () => h(menu.parts.value[name], attrs, slots);
    },
  });

export const ResponsiveMenuItem = createPart("Item");
export const ResponsiveMenuSeparator = createPart("Separator");
export const ResponsiveMenuLabel = createPart("Label");
export const ResponsiveMenuGroup = createPart("Group");
export const ResponsiveMenuSub = createPart("Sub");
export const ResponsiveMenuSubTrigger = createPart("SubTrigger");
export const ResponsiveMenuSubContent = createPart("SubContent");
export const ResponsiveMenuRadioGroup = createPart("RadioGroup");
export const ResponsiveMenuRadioItem = createPart("RadioItem");
export const ResponsiveMenuCheckboxItem = createPart("CheckboxItem");
