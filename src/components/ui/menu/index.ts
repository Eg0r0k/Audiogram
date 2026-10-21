import { type VariantProps, cva } from "class-variance-authority";
import { createContext } from "reka-ui";
import type { Ref } from "vue";

export { default as Menu } from "./Menu.vue";
export { default as MenuCheckboxItem } from "./MenuCheckboxItem.vue";
export { default as MenuGroup } from "./MenuGroup.vue";
export { default as MenuItem } from "./MenuItem.vue";
export { default as MenuLabel } from "./MenuLabel.vue";
export { default as MenuRadioGroup } from "./MenuRadioGroup.vue";
export { default as MenuRadioItem } from "./MenuRadioItem.vue";
export { default as MenuSeparator } from "./MenuSeparator.vue";
export { default as MenuShortcut } from "./MenuShortcut.vue";
export { default as MenuSub } from "./MenuSub.vue";
export { default as MenuSubContent } from "./MenuSubContent.vue";
export { default as MenuSubTrigger } from "./MenuSubTrigger.vue";
export { default as MenuTrigger } from "./MenuTrigger.vue";
export type { MenuOrigin, MenuPosition } from "./position";

export type MenuItemColor = "primary" | "neutral" | "destructive" | "success" | "warning" | "info";

export const menuTriggers = new WeakSet<Element>();

export const menuSizeVariants = cva("group/menu rounded-outset-(--menu-item-radius)/(--menu-pad) p-(--menu-pad)", {
  variants: {
    size: {
      xs: `
        text-body-sm [--menu-pad:--spacing(0.5)] [--menu-item-height:var(--control-height-xs)]
        [--menu-item-radius:--theme(--radius-item-xs)] [--menu-item-px:var(--control-padding-xs)]
        [--menu-item-py:--spacing(1.5)] [--menu-item-gap:var(--control-gap-xs)] [--menu-icon:var(--control-icon-xs)]
        [--menu-label:var(--typescale-label-sm-size)] [--menu-label-leading:var(--typescale-label-sm-line-height)]
      `,
      sm: `
        text-body-sm [--menu-pad:--spacing(1)] [--menu-item-height:var(--control-height-sm)]
        [--menu-item-radius:--theme(--radius-item-sm)] [--menu-item-px:var(--control-padding-sm)]
        [--menu-item-py:--spacing(2)] [--menu-item-gap:var(--control-gap-sm)] [--menu-icon:var(--control-icon-sm)]
        [--menu-label:var(--typescale-label-sm-size)] [--menu-label-leading:var(--typescale-label-sm-line-height)]
      `,
      md: `
        text-body-md [--menu-pad:--spacing(1)] [--menu-item-height:auto]
        [--menu-item-radius:--theme(--radius-item-md)] [--menu-item-px:--spacing(2)]
        [--menu-item-py:--spacing(1.5)] [--menu-item-gap:--spacing(3)] [--menu-icon:var(--control-icon-md)]
        [--menu-label:var(--typescale-label-md-size)] [--menu-label-leading:var(--typescale-label-md-line-height)]
      `,
      lg: `
        text-body-lg [--menu-pad:--spacing(1)] [--menu-item-height:var(--control-height-lg)]
        [--menu-item-radius:--theme(--radius-item-lg)] [--menu-item-px:var(--control-padding-lg)]
        [--menu-item-py:--spacing(2)] [--menu-item-gap:var(--control-gap-lg)] [--menu-icon:var(--control-icon-lg)]
        [--menu-label:var(--typescale-label-lg-size)] [--menu-label-leading:var(--typescale-label-lg-line-height)]
      `,
      xl: `
        text-body-lg [--menu-pad:--spacing(1)] [--menu-item-height:var(--control-height-xl)]
        [--menu-item-radius:--theme(--radius-item-xl)] [--menu-item-px:var(--control-padding-xl)]
        [--menu-item-py:--spacing(3)] [--menu-item-gap:var(--control-gap-xl)] [--menu-icon:var(--control-icon-xl)]
        [--menu-label:var(--typescale-label-lg-size)] [--menu-label-leading:var(--typescale-label-lg-line-height)]
      `,
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export type MenuSize = NonNullable<VariantProps<typeof menuSizeVariants>["size"]>;

export const [injectMenuSize, provideMenuSize] = createContext<Ref<MenuSize>>("MenuContent");

const indicatorInset = "ps-[calc(var(--menu-item-px)+var(--menu-icon)+var(--menu-item-gap))]";

export const menuItem = `
  group/menu-item relative flex min-h-(--menu-item-height) cursor-default items-center gap-(--menu-item-gap) font-semibold
  rounded-(--menu-item-radius) px-(--menu-item-px) py-(--menu-item-py) outline-none select-none
  focus-visible:focus-ring-inset
  before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-foreground
  before:opacity-0 before:transition-opacity before:duration-short-2 before:ease-standard
  data-highlighted:before:opacity-(--state-hover)
  active:not-has-[>[data-slot=ripple]>*]:before:opacity-(--state-pressed)
  data-disabled:pointer-events-none data-disabled:text-foreground/(--disabled-opacity)
  data-inset:ps-[calc(var(--menu-item-px)+var(--menu-icon)+var(--menu-item-gap))]
  data-color:text-tone-text
  data-color:before:bg-tone-text
  forced-colors:before:hidden
  forced-colors:data-highlighted:outline-2
  [&_svg]:pointer-events-none [&_svg]:shrink-0
  icon-size-(--menu-icon)
  [&>svg:not([class*=text-])]:text-muted-foreground
  data-color:[&>svg:not([class*=text-])]:text-tone-text
  data-disabled:[&>svg:not([class*=text-])]:text-foreground/(--disabled-opacity)
`;

export const menuIndicatorItem = `${menuItem} ${indicatorInset}`;

export const menuIndicator = `
  pointer-events-none absolute start-(--menu-item-px) flex size-(--menu-icon) items-center justify-center text-primary
  group-data-disabled/menu-item:text-foreground/(--disabled-opacity)
`;

export const menuRadioDot = "size-[calc(var(--menu-icon)/2)] rounded-full bg-current";

const labelText = "text-(length:--menu-label)/(--menu-label-leading) font-medium";

export const menuLabel = `px-(--menu-item-px) pt-(--menu-item-py) pb-1 ${labelText} text-muted-foreground data-inset:ps-[calc(var(--menu-item-px)+var(--menu-icon)+var(--menu-item-gap))]`;

export const menuSeparator = "-mx-(--menu-pad) my-(--menu-pad) h-px shrink-0 bg-border";

export const menuShortcut = `ms-auto ps-4 ${labelText} tracking-wider text-muted-foreground`;

export const menuSubTrigger = `${menuItem} data-[state=open]:before:opacity-(--state-hover)`;
