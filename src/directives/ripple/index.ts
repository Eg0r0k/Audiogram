import type { Directive, DirectiveBinding } from "vue";
import "./ripple.css";

interface Wave {
  id: number;
  element: HTMLElement;
  hideTimer?: ReturnType<typeof setTimeout>;
  removeTimer?: ReturnType<typeof setTimeout>;
  startTime: number;
  duration: number;
  released: boolean;
}

interface RippleOptions {
  disabled?: boolean;
  color?: string;
  opacity?: number;
  duration?: number;
}

interface RippleHTMLElement extends HTMLElement {
  _ripple?: {
    container: HTMLElement | null;
    waves: Map<number, Wave>;
    waveId: number;
    options: RippleOptions;
    handlers: {
      pointerdown: (e: PointerEvent) => void;
      pointerup: (e: PointerEvent) => void;
      pointercancel: (e: PointerEvent) => void;
      pointerleave: (e: PointerEvent) => void;
    };
    currentWaveId?: number;
  };
}

const RIPPLE_DURATION = 400;

function readDuration(container: HTMLElement, options: RippleOptions): number {
  if (options.duration) return options.duration;
  const raw = getComputedStyle(container).getPropertyValue("--ripple-duration").trim();
  const ms = raw.endsWith("ms") ? parseFloat(raw) : parseFloat(raw) * 1000;
  return Number.isFinite(ms) && ms > 0 ? ms : RIPPLE_DURATION;
}

function parseBinding(binding: DirectiveBinding): RippleOptions {
  if (typeof binding.value === "boolean") {
    return { disabled: !binding.value };
  }
  if (typeof binding.value === "object") {
    return binding.value;
  }
  return {};
}

function calcRippleSize(
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  // Distance from the press point to the farthest corner. The wave is scaled
  // to 2x by the keyframes, so it covers the element exactly at animation end
  // (tweb sizing) rather than at the halfway point.
  const dx = Math.abs(x - width / 2) + width / 2;
  const dy = Math.abs(y - height / 2) + height / 2;
  return Math.hypot(dx, dy);
}

function createRippleContainer(): HTMLElement {
  const container = document.createElement("span");
  container.className = "v-ripple";
  container.setAttribute("aria-hidden", "true");
  return container;
}

function createWaveElement(
  x: number,
  y: number,
  size: number,
  options: RippleOptions,
): HTMLElement {
  const wave = document.createElement("span");
  const halfSize = size / 2;
  wave.className = "v-ripple__circle";
  wave.style.cssText = `
    width: ${size}px;
    height: ${size}px;
    left: ${x - halfSize}px;
    top: ${y - halfSize}px;
    ${options.color ? `--ripple-color: ${options.color};` : ""}
    ${
      options.opacity !== undefined
        ? `--ripple-max-opacity: ${options.opacity};`
        : ""
    }
    ${options.duration ? `--ripple-duration: ${options.duration}ms;` : ""}
  `;

  return wave;
}

function scheduleHide(el: RippleHTMLElement, waveId: number): void {
  const ripple = el._ripple;
  if (!ripple) return;

  const wave = ripple.waves.get(waveId);
  if (!wave) return;

  const duration = wave.duration;
  const halfDuration = duration / 2;
  const elapsedTime = Date.now() - wave.startTime;

  if (elapsedTime < duration) {
    const delay = Math.max(duration - elapsedTime, halfDuration);
    const hideDelay = Math.max(delay - halfDuration, 0);

    wave.hideTimer = setTimeout(() => {
      wave.element.classList.add("hiding");
    }, hideDelay);

    wave.removeTimer = setTimeout(() => {
      wave.element.remove();
      ripple.waves.delete(waveId);
    }, delay);
  }
  else {
    wave.element.classList.add("hiding");

    wave.removeTimer = setTimeout(() => {
      wave.element.remove();
      ripple.waves.delete(waveId);
    }, halfDuration);
  }
}

const ensureContainer = (el: RippleHTMLElement): HTMLElement => {
  const ripple = el._ripple!;
  if (ripple.container) return ripple.container;

  if (window.getComputedStyle(el).position === "static") {
    el.style.position = "relative";
  }
  const container = createRippleContainer();
  el.appendChild(container);
  ripple.container = container;
  return container;
};

function setupRipple(el: RippleHTMLElement, binding: DirectiveBinding): void {
  if (el._ripple) return;

  const options = parseBinding(binding);

  const releaseWave = () => {
    const ripple = el._ripple;
    if (!ripple || ripple.currentWaveId === undefined) return;

    const wave = ripple.waves.get(ripple.currentWaveId);
    if (!wave || wave.released) return;

    wave.released = true;
    scheduleHide(el, ripple.currentWaveId);
  };

  const releasePrimary = (e: PointerEvent) => {
    if (e.isPrimary) releaseWave();
  };

  const handlers = {
    pointerdown: (e: PointerEvent) => {
      // Middle click
      if (e.button === 1) return;
      // Second finger of a multi-touch: never starts a wave (tweb ignores
      // `touches.length > 1`). Its pointerup is also non-primary and is
      // ignored below, so the primary wave still ends with the primary finger.
      if (!e.isPrimary) return;
      const ripple = el._ripple;
      if (!ripple || ripple.options.disabled) return;

      // Safety net: a wave whose release got lost (pointerup outside the
      // window, a cancelled gesture) must not outlive the next press.
      releaseWave();

      const target = e.target as HTMLElement;

      const interactiveSelector = "button, a, input, select, textarea, [role=\"button\"]";
      const closestInteractive = target.closest(interactiveSelector);
      if (closestInteractive && closestInteractive !== el) {
        return;
      }

      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = calcRippleSize(x, y, rect.width, rect.height);

      const waveId = ripple.waveId++;
      const waveElement = createWaveElement(x, y, size, ripple.options);

      const container = ensureContainer(el);
      const duration = readDuration(container, ripple.options);

      // Mount transparent, force a reflow, then clear: the wave fades in over
      // duration/2 (CSS transition) while it grows instead of popping to full
      // opacity on the first frame.
      waveElement.style.opacity = "0";
      container.appendChild(waveElement);
      waveElement.style.opacity = "";

      ripple.currentWaveId = waveId;

      ripple.waves.set(waveId, {
        id: waveId,
        element: waveElement,
        startTime: Date.now(), // same clock as scheduleHide
        duration,
        released: false,
      });
    },

    pointerup: releasePrimary,
    pointercancel: releasePrimary,
    pointerleave: releasePrimary,
  };

  el._ripple = {
    container: null,
    waves: new Map(),
    waveId: 0,
    options,
    handlers,
  };

  el.addEventListener("pointerdown", handlers.pointerdown);
  el.addEventListener("pointerup", handlers.pointerup);
  el.addEventListener("pointercancel", handlers.pointercancel);
  el.addEventListener("pointerleave", handlers.pointerleave);
}

function cleanupRipple(el: RippleHTMLElement): void {
  const ripple = el._ripple;
  if (!ripple) return;

  ripple.waves.forEach((wave) => {
    if (wave.hideTimer) clearTimeout(wave.hideTimer);
    if (wave.removeTimer) clearTimeout(wave.removeTimer);
  });

  el.removeEventListener("pointerdown", ripple.handlers.pointerdown);
  el.removeEventListener("pointerup", ripple.handlers.pointerup);
  el.removeEventListener("pointercancel", ripple.handlers.pointercancel);
  el.removeEventListener("pointerleave", ripple.handlers.pointerleave);

  ripple.container?.remove();

  delete el._ripple;
}

const vRipple: Directive<RippleHTMLElement, boolean | RippleOptions> = {
  mounted(el, binding) {
    setupRipple(el, binding);
  },

  updated(el, binding) {
    if (el._ripple) {
      el._ripple.options = parseBinding(binding);
    }
  },

  beforeUnmount(el) {
    cleanupRipple(el);
  },
};

export default vRipple;
