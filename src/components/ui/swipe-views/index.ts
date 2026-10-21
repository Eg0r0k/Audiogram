import { cva } from "class-variance-authority";

export { default as SwipeView } from "./SwipeView.vue";
export { default as SwipeViews } from "./SwipeViews.vue";
export { default as SwipeViewsSwipeArea } from "./SwipeViewsSwipeArea.vue";
export type {
  SwipeViewsLayout,
  SwipeViewsOrientation,
  SwipeViewsSide,
  SwipeViewsValue,
} from "@kappa-ui/core/swipe-views";

export const swipeViewsVariants = cva("relative overflow-clip swipe-snap", {
  variants: {
    orientation: {
      horizontal: "touch-pan-y",
      vertical: "touch-pan-x",
    },
    layout: {
      row: "flex",
      stack: "",
    },
  },
  compoundVariants: [{ orientation: "vertical", layout: "row", class: "flex-col" }],
  defaultVariants: { orientation: "horizontal", layout: "row" },
});

export const swipeViewVariants = cva("shrink-0 outline-none swipe-view focus-visible:focus-ring-inset", {
  variants: {
    orientation: { horizontal: "", vertical: "" },
    layout: { row: "", stack: "absolute" },
  },
  compoundVariants: [
    { layout: "row", orientation: "horizontal", class: "w-full translate-x-(--swipe-snap-offset)" },
    { layout: "row", orientation: "vertical", class: "h-full translate-y-(--swipe-snap-offset)" },
    { layout: "stack", orientation: "horizontal", class: "inset-y-0 start-0 w-full translate-x-(--swipe-view-stack)" },
    { layout: "stack", orientation: "vertical", class: "inset-x-0 top-0 h-full translate-y-(--swipe-view-stack)" },
  ],
  defaultVariants: { orientation: "horizontal", layout: "row" },
});

export const swipeViewsSwipeAreaVariants = cva("absolute z-10 data-disabled:pointer-events-none", {
  variants: {
    orientation: {
      horizontal: "inset-y-0 w-5 touch-pan-y",
      vertical: "inset-x-0 h-5 touch-pan-x",
    },
    side: { start: "", end: "" },
  },
  compoundVariants: [
    { orientation: "horizontal", side: "start", class: "start-0" },
    { orientation: "horizontal", side: "end", class: "end-0" },
    { orientation: "vertical", side: "start", class: "top-0" },
    { orientation: "vertical", side: "end", class: "bottom-0" },
  ],
  defaultVariants: { orientation: "horizontal", side: "start" },
});
