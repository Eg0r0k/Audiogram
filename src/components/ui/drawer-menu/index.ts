import { type VariantProps, cva } from "class-variance-authority";

export { default as DrawerMenu } from "./DrawerMenu.vue";
export { default as DrawerMenuCheckboxItem } from "./DrawerMenuCheckboxItem.vue";
export { default as DrawerMenuGroup } from "./DrawerMenuGroup.vue";
export { default as DrawerMenuItem } from "./DrawerMenuItem.vue";
export { default as DrawerMenuLabel } from "./DrawerMenuLabel.vue";
export { default as DrawerMenuRadioGroup } from "./DrawerMenuRadioGroup.vue";
export { default as DrawerMenuRadioItem } from "./DrawerMenuRadioItem.vue";
export { default as DrawerMenuSeparator } from "./DrawerMenuSeparator.vue";
export { default as DrawerMenuSub } from "./DrawerMenuSub.vue";
export { default as DrawerMenuSubContent } from "./DrawerMenuSubContent.vue";
export { default as DrawerMenuSubTrigger } from "./DrawerMenuSubTrigger.vue";

export type DrawerMenuItemColor = "primary" | "neutral" | "destructive" | "success" | "warning" | "info";

export const drawerMenuVariants = cva(
  `
    group/drawer-menu drawer-menu min-h-0 scrollbar-hidden px-(--menu-pad) [--drawer-menu-gap:0px] [--menu-pad:--spacing(2)]
    [--menu-item-gap:var(--menu-item-px)]
  `,
  {
    variants: {
      size: {
        xs: `
          text-body-md [--menu-item-height:calc(var(--control-height-xs)+--spacing(2))]
          [--menu-item-px:calc(var(--control-padding-xs)+--spacing(0.5))] [--menu-item-py:--spacing(1.5)]
          [--menu-icon:var(--control-icon-xs)] [--menu-label:var(--typescale-label-md-size)]
          [--menu-label-leading:var(--typescale-label-md-line-height)]
        `,
        sm: `
          text-body-md [--menu-item-height:calc(var(--control-height-sm)+--spacing(2))]
          [--menu-item-px:calc(var(--control-padding-sm)+--spacing(0.5))] [--menu-item-py:--spacing(2)]
          [--menu-icon:var(--control-icon-sm)] [--menu-label:var(--typescale-label-md-size)]
          [--menu-label-leading:var(--typescale-label-md-line-height)]
        `,
        md: `
          text-body-lg [--menu-item-height:calc(var(--control-height-md)+--spacing(3))]
          [--menu-item-px:--spacing(3)] [--menu-item-py:--spacing(3)]
          [--menu-icon:calc(var(--control-icon-md)+--spacing(1))] [--menu-label:var(--typescale-label-lg-size)]
          [--menu-label-leading:var(--typescale-label-lg-line-height)]
        `,
        lg: `
          text-body-lg [--menu-item-height:calc(var(--control-height-lg)+--spacing(4))]
          [--menu-item-px:calc(var(--control-padding-lg)+--spacing(1))] [--menu-item-py:--spacing(3)]
          [--menu-icon:calc(var(--control-icon-lg)+--spacing(1))] [--menu-label:var(--typescale-label-lg-size)]
          [--menu-label-leading:var(--typescale-label-lg-line-height)]
        `,
        xl: `
          text-body-lg [--menu-item-height:calc(var(--control-height-xl)+--spacing(4))]
          [--menu-item-px:calc(var(--control-padding-xl)+--spacing(1))] [--menu-item-py:--spacing(4)]
          [--menu-icon:calc(var(--control-icon-xl)+--spacing(1))] [--menu-label:var(--typescale-label-lg-size)]
          [--menu-label-leading:var(--typescale-label-lg-line-height)]
        `,
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export type DrawerMenuSize = NonNullable<VariantProps<typeof drawerMenuVariants>["size"]>;

export const drawerMenuItem = `
  group/drawer-menu-item relative flex min-h-(--menu-item-height) cursor-default items-center gap-(--menu-item-gap)
  rounded-lg px-(--menu-item-px) py-(--menu-item-py) font-medium outline-none select-none
  focus-visible:focus-ring-inset
  before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit] before:bg-foreground
  before:opacity-0 before:transition-opacity before:duration-short-2 before:ease-standard
  data-highlighted:before:opacity-(--state-hover)
  active:not-has-[>[data-slot=ripple]>*]:before:opacity-(--state-pressed)
  data-disabled:pointer-events-none data-disabled:text-foreground/(--disabled-opacity)
  data-inset:ps-[calc(var(--menu-item-px)*2+var(--menu-icon))]
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

export const drawerMenuIndicatorItem = `${drawerMenuItem} ps-[calc(var(--menu-item-px)*2+var(--menu-icon))]`;

export const drawerMenuIndicator = `
  pointer-events-none absolute start-(--menu-item-px) flex size-(--menu-icon) items-center justify-center text-primary
  group-data-disabled/drawer-menu-item:text-foreground/(--disabled-opacity)
`;

export const drawerMenuRadioDot = "size-[calc(var(--menu-icon)/2)] rounded-full bg-current";

export const drawerMenuLabel = `
  px-(--menu-item-px) pt-(--menu-item-py) pb-1 text-(length:--menu-label)/(--menu-label-leading) font-medium
  text-muted-foreground
  data-inset:ps-[calc(var(--menu-item-px)*2+var(--menu-icon))]
`;

export const drawerMenuSeparator = "my-1 h-px shrink-0 bg-muted";

export const drawerMenuBack = `${drawerMenuItem} font-medium`;
