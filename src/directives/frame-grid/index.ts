import type { Directive } from "vue";
import { alignToGrid } from "@/lib/frame-grid";

/**
 * Puts the CSS animations of the element and its subtree on the shared frame
 * grid when it mounts: a CSS animation starts when its element gets a style,
 * which is never on the grid. Only meaningful for animations whose duration,
 * delays and steps are whole grid ticks.
 */
const vFrameGrid: Directive<HTMLElement> = {
  mounted: (el) => {
    for (const animation of el.getAnimations({ subtree: true })) {
      if ("animationName" in animation) alignToGrid(animation).catch(() => {});
    }
  },
};

export default vFrameGrid;
