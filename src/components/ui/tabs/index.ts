import { type VariantProps, cva } from "class-variance-authority";

export { default as Tabs } from "./Tabs.vue";
export { default as TabsContent } from "./TabsContent.vue";
export { default as TabsList } from "./TabsList.vue";
export { default as TabsTrigger } from "./TabsTrigger.vue";

export type TabsColor = "primary" | "neutral" | "destructive" | "success" | "warning" | "info";

const sizes = {
  xs: "text-label-sm [--tabs-trigger-radius:--theme(--radius-control-xs)] [--tabs-trigger-height:var(--control-height-xs)] [--tabs-trigger-px:var(--control-padding-xs)] [--tabs-trigger-gap:var(--control-gap-xs)] [--tabs-icon:var(--control-icon-xs)]",
  sm: "text-label-md [--tabs-trigger-radius:--theme(--radius-control-sm)] [--tabs-trigger-height:var(--control-height-sm)] [--tabs-trigger-px:var(--control-padding-sm)] [--tabs-trigger-gap:var(--control-gap-sm)] [--tabs-icon:var(--control-icon-sm)]",
  md: "text-label-lg [--tabs-trigger-radius:--theme(--radius-control-md)] [--tabs-trigger-height:--spacing(10)] [--tabs-trigger-px:--spacing(4)] [--tabs-trigger-gap:var(--control-gap-md)] [--tabs-icon:var(--control-icon-md)]",
  lg: "text-label-lg [--tabs-trigger-radius:--theme(--radius-control-lg)] [--tabs-trigger-height:var(--control-height-lg)] [--tabs-trigger-px:var(--control-padding-lg)] [--tabs-trigger-gap:var(--control-gap-lg)] [--tabs-icon:var(--control-icon-lg)]",
  xl: "text-label-lg [--tabs-trigger-radius:--theme(--radius-control-xl)] [--tabs-trigger-height:var(--control-height-xl)] [--tabs-trigger-px:var(--control-padding-xl)] [--tabs-trigger-gap:var(--control-gap-xl)] [--tabs-icon:var(--control-icon-xl)]",
};

const pillInnerRadius = "rounded-(--tabs-trigger-radius)";

export const tabsListVariants = cva(
  `
    group/tabs-list relative isolate inline-flex w-fit shrink-0 items-center [--tabs-trigger-flex:none]
    aria-[orientation=vertical]:flex-col aria-[orientation=vertical]:items-stretch
    aria-[orientation=vertical]:self-start
  `,
  {
    variants: {
      variant: {
        pill: "rounded-outset-(--tabs-trigger-radius)/1 bg-muted p-1 aria-[orientation=horizontal]:[--tabs-trigger-flex:1]",
        line: "gap-1",
        // Separate round chips; each trigger draws its own fill, so no indicator.
        chip: "gap-2",
      },
      size: sizes,
    },
    defaultVariants: { variant: "pill", size: "md" },
  },
);

export const tabsIndicatorVariants = cva(
  `
    pointer-events-none absolute transition-[translate,width,height] duration-short-4 ease-standard
    motion-reduce:transition-none
    group-aria-[orientation=horizontal]/tabs-list:left-0
    group-aria-[orientation=horizontal]/tabs-list:w-(--reka-tabs-indicator-size)
    group-aria-[orientation=horizontal]/tabs-list:translate-x-(--reka-tabs-indicator-position)
    group-aria-[orientation=vertical]/tabs-list:top-0
    group-aria-[orientation=vertical]/tabs-list:h-(--reka-tabs-indicator-size)
    group-aria-[orientation=vertical]/tabs-list:translate-y-(--reka-tabs-indicator-position)
  `,
  {
    variants: {
      variant: {
        pill: `
          bg-(--tabs-pill) shadow-shadow-sm
          group-aria-[orientation=horizontal]/tabs-list:top-1/2
          group-aria-[orientation=horizontal]/tabs-list:-translate-y-1/2
          group-aria-[orientation=horizontal]/tabs-list:h-(--reka-tabs-indicator-thickness)
          group-aria-[orientation=vertical]/tabs-list:left-1/2
          group-aria-[orientation=vertical]/tabs-list:-translate-x-1/2
          group-aria-[orientation=vertical]/tabs-list:w-(--reka-tabs-indicator-thickness)
        `,
        line: `
          rounded-full bg-tone-text
          group-aria-[orientation=horizontal]/tabs-list:bottom-0 group-aria-[orientation=horizontal]/tabs-list:h-0.5
          group-aria-[orientation=horizontal]/tabs-list:scale-x-65
          group-aria-[orientation=vertical]/tabs-list:-end-px group-aria-[orientation=vertical]/tabs-list:w-0.5
        `,
        chip: "hidden",
      },
    },
    compoundVariants: [{ variant: "pill", class: pillInnerRadius }],
    defaultVariants: { variant: "pill" },
  },
);

export const tabsTrigger = `
  relative z-1 inline-flex h-(--tabs-trigger-height) flex-[var(--tabs-trigger-flex)] items-center justify-center
  gap-(--tabs-trigger-gap) rounded-(--tabs-trigger-radius) px-(--tabs-trigger-px) whitespace-nowrap
  text-muted-foreground outline-none transition-colors duration-short-4 ease-standard
  hover:text-foreground
  focus-visible:focus-ring
  data-[state=active]:text-foreground
  group-data-[variant=line]/tabs-list:data-[state=active]:text-tone-text
  group-data-[variant=chip]/tabs-list:rounded-full group-data-[variant=chip]/tabs-list:bg-muted
  group-data-[variant=chip]/tabs-list:text-foreground
  group-data-[variant=chip]/tabs-list:data-[state=active]:bg-foreground
  group-data-[variant=chip]/tabs-list:data-[state=active]:text-background
  data-disabled:pointer-events-none data-disabled:text-foreground/(--disabled-opacity)
  data-[orientation=vertical]:justify-start
  [&_svg]:pointer-events-none [&_svg]:shrink-0
  icon-size-(--tabs-icon)
`;

export const tabsContent = "flex-1 rounded-surface-xs outline-none focus-visible:focus-ring";

export type TabsListVariants = VariantProps<typeof tabsListVariants>;
export type TabsSize = NonNullable<TabsListVariants["size"]>;
