<template>
  <div
    ref="container"
    class="slide-transition-container"
  >
    <Transition
      :name="transitionName"
      @before-enter="onBeforeEnter"
      @enter="onEnter"
      @after-enter="onEnterSettled"
      @enter-cancelled="onEnterSettled"
      @before-leave="onBeforeLeave"
    >
      <slot />
    </Transition>
    <div
      ref="dim"
      class="slide-dim"
      aria-hidden="true"
    />
  </div>
</template>

<script setup lang="ts">
import { provide, readonly, ref, useTemplateRef, watch } from "vue";
import { useRoute } from "vue-router";
import { SLIDE_CONTENT_READY_KEY, useSlideContentReady } from "./slideContentReady";

const props = defineProps<{
  depth?: number;
  /**
   * Break ties between pages of the same depth (album → artist) by the
   * browser history direction: a push slides in, back/forward slides out.
   * Depth 0 pages are tab roots and never slide between each other.
   */
  historyAware?: boolean;
}>();

const route = useRoute();
const transitionName = ref("");
const hasHash = (fullPath: string) => fullPath.includes("#");

// vue-router stamps its history index onto history.state; the watcher below
// runs after the entry was pushed/popped, so this already reads the new one.
const historyPosition = (): number => {
  const position = typeof history !== "undefined" ? history.state?.position : undefined;
  return typeof position === "number" ? position : 0;
};
let lastPosition = historyPosition();

const resolveByHistory = (): string => {
  const position = historyPosition();
  const delta = position - lastPosition;
  lastPosition = position;
  if (delta > 0) return "slide-left";
  if (delta < 0) return "slide-right";
  return "";
};

type TransitionSources = [depth: number | undefined, fullPath: string];

const resolveTransitionName = (
  [newDepth, newFullPath]: TransitionSources,
  [oldDepth, oldFullPath]: TransitionSources,
): string => {
  if (hasHash(newFullPath) || hasHash(oldFullPath)) return "";
  if (newDepth === undefined || oldDepth === undefined) return "";

  if (newDepth !== oldDepth) {
    lastPosition = historyPosition();
    return newDepth > oldDepth ? "slide-left" : "slide-right";
  }

  if (!props.historyAware || newDepth === 0) return "";
  return resolveByHistory();
};

// Heavy children (see useSlideContentReady) mount only once the enter
// transition is running on the compositor, so their mount cost no longer sits
// between the click and the first frame of motion. A nested SlideTransition
// starts gated by its parent's slide, so a page that contains one (mobile
// IndexPage) still defers the inner list until the outer slide has started.
const outerReady = useSlideContentReady();
const contentReady = ref(outerReady.value);
provide(SLIDE_CONTENT_READY_KEY, readonly(contentReady));

let enterArmed = false;
let enterInFlight = false;
let stopListening: (() => void) | null = null;

const releaseContent = () => {
  stopListening?.();
  stopListening = null;
  contentReady.value = true;
};

if (!outerReady.value) {
  watch(outerReady, releaseContent, { once: true });
}

// Only a page sliding in from off-screen (slide-left) hides its blank frames.
// A page returning from behind (slide-right) is 80% visible from the first
// frame, and a page replacing an interrupted enter (quick back mid-slide)
// takes over from content that is already on screen: both render in full.
const applyTransition = (name: string) => {
  transitionName.value = name;
  enterArmed = false;
  contentReady.value = name !== "slide-left" || enterInFlight;
};

const container = useTemplateRef<HTMLElement>("container");
const dim = useTemplateRef<HTMLElement>("dim");

const ACTIVE_CLASSES = ["slide-left-enter-active", "slide-left-leave-active", "slide-right-enter-active", "slide-right-leave-active"];

// Where each page caught mid-slide stood when the next navigation came in.
// Read before the patch: by the time Vue's hooks run, a cancelled enter has
// dropped its classes and snapped back to rest, and a leaving page with the
// incoming key is already gone.
const midSlide = new Map<Element, { x: number; leaving: boolean }>();

const captureMidSlide = () => {
  midSlide.clear();
  const root = container.value;
  if (!root) return;
  for (const child of root.children) {
    const active = ACTIVE_CLASSES.find(name => child.classList.contains(name));
    if (!active) continue;
    midSlide.set(child, {
      x: new DOMMatrix(getComputedStyle(child).transform).m41,
      leaving: active.endsWith("-leave-active"),
    });
  }
  if (midSlide.size > 0 && dim.value) root.style.setProperty("--slide-dim-from", getComputedStyle(dim.value).opacity);
  else root.style.removeProperty("--slide-dim-from");
};

const onBeforeEnter = (el: Element) => {
  enterArmed = true;
  enterInFlight = true;
  // A page coming back while its previous instance was still leaving (a quick
  // back mid-slide) takes over from where that instance stood: Vue removed it
  // right before this hook, so it is the leaving one no longer in the DOM.
  for (const [node, state] of midSlide) {
    if (state.leaving && !node.isConnected) {
      (el as HTMLElement).style.setProperty("--slide-enter-from-x", `${state.x}px`);
      break;
    }
  }
};

const onBeforeLeave = (el: Element) => {
  const page = el as HTMLElement;
  // The page on its way out takes no clicks or focus while it is still on screen.
  page.inert = true;
  // A page reversed mid-enter leaves from where it stood, not from rest.
  const state = midSlide.get(el);
  if (state && !state.leaving) page.style.setProperty("--slide-leave-from-x", `${state.x}px`);
};

const onEnter = (el: Element) => {
  const onTransitionStart = (event: Event) => {
    if (event.target === el) releaseContent();
  };
  el.addEventListener("transitionstart", onTransitionStart);
  stopListening = () => el.removeEventListener("transitionstart", onTransitionStart);
};

const onEnterSettled = (el: Element) => {
  enterInFlight = false;
  (el as HTMLElement).style.removeProperty("--slide-enter-from-x");
  releaseContent();
};

const transitionSources = [() => props.depth, () => route.fullPath] as const;

watch(transitionSources, () => {
  if (!enterArmed) releaseContent();
}, { flush: "post" });

watch(transitionSources, (next, prev) => {
  captureMidSlide();
  applyTransition(resolveTransitionName(next, prev));
});
</script>
<style>
:root {
  /* tweb navigation slide. Entering motion is ease-out, but this curve starts
     at rest: a strong ease-out covers a quarter of the page on frame one,
     which reads as a jump. Back is shorter than forward. */
  --slide-easing: cubic-bezier(0.2, 0, 0, 1);
  --slide-duration-in: var(--transition-duration-medium-2, 300ms);
  --slide-duration-out: var(--transition-duration-medium-1, 250ms);
  --parallax-offset: -25%;
  --slide-dim: 0.2;
}

.slide-transition-container {
  display: grid;
  grid-template-columns: 100%;
  grid-template-rows: 100%;
  width: 100%;
  height: 100%;
  overflow: hidden;

  position: relative;
  /* Keeps the pages' z-indexes inside the container. */
  isolation: isolate;
}

.slide-transition-container > * {
  grid-column: 1;
  grid-row: 1;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  /* A 2D identity keeps the page the containing block of its fixed children
     (MediaHeader) without promoting it to a layer at rest. A layer that keeps
     will-change after the slide keeps the raster it got mid-motion: a return
     from -25% lands half a pixel off and blurs, and the text loses LCD smoothing. */
  transform: translate(0, 0);
  /* Above a page still leaving (z-index 1): Vue can end the enter a frame or
     two before it removes the old page, which would flash over the new one. */
  z-index: 2;
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  will-change: transform;
}

/* Only the page on top casts its edge shadow, and only while it moves. */
.slide-left-enter-active,
.slide-right-leave-active {
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
}

/* The grid already stacks both pages in one cell; switching to
   position:absolute here forced a layout on the first frame of motion. */
.slide-left-enter-active,
.slide-left-leave-active {
  transition: transform var(--slide-duration-in) var(--slide-easing);
}
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform var(--slide-duration-out) var(--slide-easing);
}

/* The -from variables are set by the script when a page is caught mid-slide,
   so the next slide continues from where it stood. */
.slide-left-enter-from {
  transform: translate3d(var(--slide-enter-from-x, 100%), 0, 0);
  z-index: 50;
}
.slide-left-enter-to {
  transform: translate3d(0, 0, 0);
  z-index: 50;
}

.slide-left-leave-from {
  transform: translate3d(var(--slide-leave-from-x, 0px), 0, 0);
  z-index: 1;
}
.slide-left-leave-to {
  transform: translate3d(var(--parallax-offset), 0, 0);
  z-index: 1;
}
.slide-right-enter-from {
  transform: translate3d(var(--slide-enter-from-x, var(--parallax-offset)), 0, 0);
  z-index: 1;
}
.slide-right-enter-to {
  transform: translate3d(0, 0, 0);
  z-index: 1;
}

.slide-right-leave-from {
  transform: translate3d(var(--slide-leave-from-x, 0px), 0, 0);
  z-index: 50;
}
.slide-right-leave-to {
  transform: translate3d(100%, 0, 0);
  z-index: 50;
}

/* The page beneath is darkened by one layer between the two pages, so the
   slide animates opacity and transform only, never a filter on a whole page.
   It follows the pages' classes; its rest state snaps without a transition.
   The layer is the container's last child and reads the pages through sibling
   combinators: a :has() on the container would make Chrome restyle the whole
   page on every node inserted into it, together with kappa's :has() rules. */
.slide-transition-container > .slide-dim {
  overflow: hidden;
  transform: none;
  z-index: 25;
  background: #000;
  opacity: 0;
  pointer-events: none;
}

.slide-transition-container > .slide-left-leave-from ~ .slide-dim {
  opacity: var(--slide-dim-from, 0);
}
.slide-transition-container > .slide-left-leave-to ~ .slide-left-enter-active ~ .slide-dim,
.slide-transition-container > .slide-left-enter-active ~ .slide-left-leave-to ~ .slide-dim {
  opacity: var(--slide-dim);
  transition: opacity var(--slide-duration-in) var(--slide-easing);
}
.slide-transition-container > .slide-right-enter-from ~ .slide-dim {
  opacity: var(--slide-dim-from, var(--slide-dim));
}
.slide-transition-container > .slide-right-enter-to ~ .slide-right-leave-active ~ .slide-dim,
.slide-transition-container > .slide-right-leave-active ~ .slide-right-enter-to ~ .slide-dim {
  opacity: 0;
  transition: opacity var(--slide-duration-out) var(--slide-easing);
}

/* Reduced motion keeps the change of page, not the travel: the page on top
   fades over the one beneath. Specific enough to beat the global rule that
   collapses every transition. */
@media (prefers-reduced-motion: reduce) {
  .slide-transition-container > :is(.slide-left-enter-active, .slide-left-leave-active, .slide-right-enter-active, .slide-right-leave-active) {
    transform: translate(0, 0);
    box-shadow: none;
    transition: opacity var(--transition-duration-short-3, 150ms) ease-out !important;
  }
  .slide-transition-container > :is(.slide-left-enter-from, .slide-right-leave-to) {
    opacity: 0;
  }
  .slide-transition-container > .slide-dim {
    display: none;
  }
}
</style>
