export { default as Popover } from "./Popover.vue";
export { default as PopoverAnchor } from "./PopoverAnchor.vue";
export { default as PopoverContent } from "./PopoverContent.vue";
export { default as PopoverTrigger } from "./PopoverTrigger.vue";

export const overlaySurface = `
  z-50 rounded-surface-md border border-surface-border bg-popover text-popover-foreground shadow-shadow-popover
  outline-none animate-overlay [--scroll-fade-color:var(--popover)]
`;
