import { type VariantProps, cva } from "class-variance-authority";

export { default as Drawer } from "./Drawer.vue";
export { default as DrawerBody } from "./DrawerBody.vue";
export { default as DrawerClose } from "./DrawerClose.vue";
export { default as DrawerContent } from "./DrawerContent.vue";
export { default as DrawerDescription } from "./DrawerDescription.vue";
export { default as DrawerFooter } from "./DrawerFooter.vue";
export { default as DrawerHandle } from "./DrawerHandle.vue";
export { default as DrawerHeader } from "./DrawerHeader.vue";
export { default as DrawerIndent } from "./DrawerIndent.vue";
export { default as DrawerOverlay } from "./DrawerOverlay.vue";
export { default as DrawerSwipeArea } from "./DrawerSwipeArea.vue";
export { default as DrawerTitle } from "./DrawerTitle.vue";
export { default as DrawerTrigger } from "./DrawerTrigger.vue";
export { type DialogHandle, type DialogResult, useDialogContext } from "@kappa-ui/core/dialog";
export { type DrawerOptions, defineDrawer, openDrawer } from "@kappa-ui/core/drawer";

export const drawerSurface = `
  group/drawer fixed z-50 flex flex-col bg-dialog pb-2 text-dialog-foreground ring-1 ring-surface-border
  outline-none drawer-slide [--scroll-fade-color:--theme(--color-dialog)]
`;

// side names a screen edge, not a reading direction, so everything placed by it is physical: under dir="rtl" the
// rounded corners and the handle stay on the inner edge and the swipe area on the screen edge
export const drawerContentVariants = cva("", {
  variants: {
    side: {
      bottom: `
        inset-x-0 bottom-0 max-h-[calc(100vh-var(--drawer-keyboard-inset))] supports-[height:100dvh]:max-h-[calc(100dvh-var(--drawer-keyboard-inset))] touch-pan-x rounded-t-2xl
        pb-[max(env(safe-area-inset-bottom),--spacing(2))]
      `,
      top: `
        inset-x-0 top-0 max-h-[calc(100vh-var(--drawer-keyboard-inset))] supports-[height:100dvh]:max-h-[calc(100dvh-var(--drawer-keyboard-inset))] touch-pan-x rounded-b-surface-lg
        pt-[calc(--spacing(4)+env(safe-area-inset-top))]
      `,
      left: "inset-y-0 left-0 w-3/4 max-w-sm touch-pan-y rounded-r-surface-lg",
      right: "inset-y-0 right-0 w-3/4 max-w-sm touch-pan-y rounded-l-surface-lg",
    },
  },
  defaultVariants: { side: "bottom" },
});

export const drawerHandleVariants = cva(
  "relative shrink-0 cursor-grab touch-none rounded-full bg-muted-foreground/30 touch-target",
  {
    variants: {
      side: {
        bottom: "mx-auto my-3 h-1.5 w-10",
        top: "order-last mx-auto h-1.5 w-12",
        left: "absolute top-1/2 right-2 h-12 w-1.5 -translate-y-1/2",
        right: "absolute top-1/2 left-2 h-12 w-1.5 -translate-y-1/2",
      },
    },
    defaultVariants: { side: "bottom" },
  },
);

export const drawerSwipeAreaVariants = cva("fixed z-40", {
  variants: {
    side: {
      bottom: "inset-x-0 bottom-0 h-5 touch-pan-x",
      top: "inset-x-0 top-0 h-5 touch-pan-x",
      left: "inset-y-0 left-0 w-5 touch-pan-y",
      right: "inset-y-0 right-0 w-5 touch-pan-y",
    },
  },
  defaultVariants: { side: "bottom" },
});

export type DrawerContentVariants = VariantProps<typeof drawerContentVariants>;
