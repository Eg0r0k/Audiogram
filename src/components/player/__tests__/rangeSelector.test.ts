import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import RangeSelector from "../RangeSelector.vue";

vi.mock("@/helpers/environment/lang", () => ({
  isRTL: vi.fn(() => false),
}));

const eventListeners = new Map<string, Set<EventListener>>();

vi.mock("@vueuse/core", async () => {
  const actual = await vi.importActual("@vueuse/core");
  return {
    ...actual,
    useElementBounding: () => ({
      width: ref(200),
      height: ref(20),
      left: ref(0),
      bottom: ref(20),
    }),
    useEventListener: (
      target: EventTarget | { value: EventTarget | null } | null,
      event: string,
      handler: EventListener,
      options?: AddEventListenerOptions,
    ) => {
      const addListener = (el: EventTarget) => {
        el.addEventListener(event, handler, options);
        if (!eventListeners.has(event)) {
          eventListeners.set(event, new Set());
        }
        eventListeners.get(event)!.add(handler);
      };

      if (target === null) return () => {};

      if (target && "value" in target) {
        const refTarget = target as { value: EventTarget | null };
        if (refTarget.value) {
          addListener(refTarget.value);
        }

        const interval = setInterval(() => {
          if (refTarget.value) {
            addListener(refTarget.value);
            clearInterval(interval);
          }
        }, 0);

        return () => {
          clearInterval(interval);
          if (refTarget.value) {
            refTarget.value.removeEventListener(event, handler, options);
          }
        };
      }

      addListener(target as EventTarget);
      return () => {
        (target as EventTarget).removeEventListener(event, handler, options);
      };
    },
  };
});

describe("RangeSelector", () => {
  let wrapper: VueWrapper;

  const createWrapper = async (props = {}) => {
    const w = mount(RangeSelector, {
      props: {
        step: 1,
        min: 0,
        max: 100,
        modelValue: 0,
        ...props,
      },
      attachTo: document.body,
    });
    await nextTick();
    await new Promise(r => setTimeout(r, 10));
    await nextTick();
    return w;
  };

  beforeEach(() => {
    eventListeners.clear();
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  describe("rendering", () => {
    it("renders correctly with default props", async () => {
      wrapper = await createWrapper();

      expect(wrapper.find(".range-selector").exists()).toBe(true);
      expect(wrapper.find(".range-selector__filled").exists()).toBe(true);
      expect(wrapper.find(".range-selector__input").exists()).toBe(true);
    });

    it("applies correct attributes to input", async () => {
      wrapper = await createWrapper({
        step: 0.5,
        min: 10,
        max: 50,
        modelValue: 25,
      });

      const input = wrapper.find(".range-selector__input");
      expect(input.attributes("type")).toBe("range");
      expect(input.attributes("step")).toBe("0.5");
      expect(input.attributes("min")).toBe("10");
      expect(input.attributes("max")).toBe("50");
      expect(input.attributes("value")).toBe("25");
    });

    it("applies transform class when useTransform is true", async () => {
      wrapper = await createWrapper({ useTransform: true });

      expect(wrapper.find(".range-selector--transform").exists()).toBe(true);
    });

    it("applies transition class when withTransition is true", async () => {
      wrapper = await createWrapper({ withTransition: true });

      expect(wrapper.find(".range-selector--transition").exists()).toBe(true);
    });

    it("does not apply transition class when useTransform is also true", async () => {
      wrapper = await createWrapper({ withTransition: true, useTransform: true });

      expect(wrapper.find(".range-selector--transition").exists()).toBe(false);
      expect(wrapper.find(".range-selector--transform").exists()).toBe(true);
    });
  });

  describe("v-model", () => {
    it("emits update:modelValue on input change", async () => {
      wrapper = await createWrapper({ modelValue: 50 });

      const input = wrapper.find(".range-selector__input");
      await input.setValue("75");
      await input.trigger("input");

      expect(wrapper.emitted("update:modelValue")).toBeTruthy();
      expect(wrapper.emitted("update:modelValue")![0]).toEqual([75]);
    });

    it("emits scrub event on input change", async () => {
      wrapper = await createWrapper({ modelValue: 50 });

      const input = wrapper.find(".range-selector__input");
      await input.setValue("75");
      await input.trigger("input");

      expect(wrapper.emitted("scrub")).toBeTruthy();
      expect(wrapper.emitted("scrub")![0]).toEqual([75]);
    });

    it("updates internal value when modelValue prop changes", async () => {
      wrapper = await createWrapper({ modelValue: 20 });

      await wrapper.setProps({ modelValue: 80 });
      await nextTick();

      const input = wrapper.find(".range-selector__input");
      expect(input.attributes("value")).toBe("80");
    });
  });

  describe("keyboard navigation", () => {
    it("increases value on ArrowRight", async () => {
      wrapper = await createWrapper({ modelValue: 50, keyboardStep: 5 });

      const input = wrapper.find(".range-selector__input");
      await input.trigger("keydown", { key: "ArrowRight" });

      expect(wrapper.emitted("update:modelValue")).toBeTruthy();
      expect(wrapper.emitted("update:modelValue")![0]).toEqual([55]);
    });

    it("decreases value on ArrowLeft", async () => {
      wrapper = await createWrapper({ modelValue: 50, keyboardStep: 5 });

      const input = wrapper.find(".range-selector__input");
      await input.trigger("keydown", { key: "ArrowLeft" });

      expect(wrapper.emitted("update:modelValue")).toBeTruthy();
      expect(wrapper.emitted("update:modelValue")![0]).toEqual([45]);
    });

    it("increases value on ArrowUp", async () => {
      wrapper = await createWrapper({ modelValue: 50, keyboardStep: 10 });

      const input = wrapper.find(".range-selector__input");
      await input.trigger("keydown", { key: "ArrowUp" });

      expect(wrapper.emitted("update:modelValue")![0]).toEqual([60]);
    });

    it("decreases value on ArrowDown", async () => {
      wrapper = await createWrapper({ modelValue: 50, keyboardStep: 10 });

      const input = wrapper.find(".range-selector__input");
      await input.trigger("keydown", { key: "ArrowDown" });

      expect(wrapper.emitted("update:modelValue")![0]).toEqual([40]);
    });

    it("uses default keyboardStep of (max - min) / 20", async () => {
      wrapper = await createWrapper({ modelValue: 50, min: 0, max: 100 });

      const input = wrapper.find(".range-selector__input");
      await input.trigger("keydown", { key: "ArrowRight" });

      expect(wrapper.emitted("update:modelValue")![0]).toEqual([55]);
    });

    it("clamps value to max", async () => {
      wrapper = await createWrapper({ modelValue: 95, keyboardStep: 10, max: 100 });

      const input = wrapper.find(".range-selector__input");
      await input.trigger("keydown", { key: "ArrowRight" });

      expect(wrapper.emitted("update:modelValue")![0]).toEqual([100]);
    });

    it("clamps value to min", async () => {
      wrapper = await createWrapper({ modelValue: 5, keyboardStep: 10, min: 0 });

      const input = wrapper.find(".range-selector__input");
      await input.trigger("keydown", { key: "ArrowLeft" });

      expect(wrapper.emitted("update:modelValue")![0]).toEqual([0]);
    });

    it("stops propagation for arrow keys", async () => {
      wrapper = await createWrapper({ modelValue: 50 });

      const input = wrapper.find(".range-selector__input");
      const event = new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
      });
      const stopPropagationSpy = vi.spyOn(event, "stopPropagation");

      input.element.dispatchEvent(event);

      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    it("does not emit for non-arrow keys", async () => {
      wrapper = await createWrapper({ modelValue: 50 });

      const input = wrapper.find(".range-selector__input");
      await input.trigger("keydown", { key: "Enter" });
      await input.trigger("keydown", { key: "Space" });
      await input.trigger("keydown", { key: "a" });

      expect(wrapper.emitted("update:modelValue")).toBeFalsy();
    });
  });

  describe("mouse interactions", () => {
    it("emits mousedown event on pointer down", async () => {
      wrapper = await createWrapper();

      const container = wrapper.find(".range-selector").element;
      container.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          clientY: 10,
          bubbles: true,
        }),
      );
      await nextTick();

      expect(wrapper.emitted("mousedown")).toBeTruthy();
    });

    it("adds active class on mousedown", async () => {
      wrapper = await createWrapper();

      const container = wrapper.find(".range-selector").element;
      container.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          clientY: 10,
          bubbles: true,
        }),
      );
      await nextTick();

      expect(wrapper.find(".range-selector--active").exists()).toBe(true);
    });

    it("emits mouseup event on pointer up", async () => {
      wrapper = await createWrapper();

      const container = wrapper.find(".range-selector").element;
      container.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          clientY: 10,
          bubbles: true,
        }),
      );
      await nextTick();

      document.dispatchEvent(
        new MouseEvent("mouseup", {
          clientX: 100,
          clientY: 10,
        }),
      );
      await nextTick();

      expect(wrapper.emitted("mouseup")).toBeTruthy();
    });

    it("removes active class on mouseup", async () => {
      wrapper = await createWrapper();

      const container = wrapper.find(".range-selector").element;
      container.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          clientY: 10,
          bubbles: true,
        }),
      );
      await nextTick();

      expect(wrapper.find(".range-selector--active").exists()).toBe(true);

      document.dispatchEvent(
        new MouseEvent("mouseup", {
          clientX: 100,
          clientY: 10,
        }),
      );
      await nextTick();

      expect(wrapper.find(".range-selector--active").exists()).toBe(false);
    });

    it("scrubs to correct value based on click position", async () => {
      wrapper = await createWrapper({ min: 0, max: 100 });

      const container = wrapper.find(".range-selector").element;
      container.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          clientY: 10,
          bubbles: true,
        }),
      );
      await nextTick();

      expect(wrapper.emitted("update:modelValue")).toBeTruthy();
      expect(wrapper.emitted("scrub")).toBeTruthy();
    });
  });

  describe("touch interactions", () => {
    it("handles touchstart", async () => {
      wrapper = await createWrapper();

      const container = wrapper.find(".range-selector").element;
      const touch = { clientX: 100, clientY: 10 } as Touch;
      const touchEvent = new TouchEvent("touchstart", {
        touches: [touch],
        bubbles: true,
      });
      container.dispatchEvent(touchEvent);
      await nextTick();

      expect(wrapper.emitted("mousedown")).toBeTruthy();
      expect(wrapper.find(".range-selector--active").exists()).toBe(true);
    });
  });

  describe("filled bar styles", () => {
    it("sets width style when useTransform is false", async () => {
      wrapper = await createWrapper({ modelValue: 50, useTransform: false });

      const vm = wrapper.vm as unknown as { setProgress: (v: number) => void };
      vm.setProgress(50);
      await nextTick();

      const filled = wrapper.find(".range-selector__filled").element as HTMLElement;
      expect(filled.style.width).toBe("50%");
    });

    it("sets transform style when useTransform is true", async () => {
      wrapper = await createWrapper({ modelValue: 50, useTransform: true });

      const vm = wrapper.vm as unknown as { setProgress: (v: number) => void };
      vm.setProgress(50);
      await nextTick();

      const filled = wrapper.find(".range-selector__filled").element as HTMLElement;
      expect(filled.style.transform).toBe("scaleX(0.5)");
    });

    it("updates filled bar on value change", async () => {
      wrapper = await createWrapper({ modelValue: 25 });

      const vm = wrapper.vm as unknown as { setProgress: (v: number) => void };
      vm.setProgress(25);
      await nextTick();

      const filled = wrapper.find(".range-selector__filled").element as HTMLElement;
      expect(filled.style.width).toBe("25%");

      vm.setProgress(75);
      await nextTick();

      expect(filled.style.width).toBe("75%");
    });
  });

  describe("exposed methods", () => {
    it("exposes setProgress method", async () => {
      wrapper = await createWrapper({ modelValue: 0 });

      const vm = wrapper.vm as unknown as {
        setProgress: (value: number) => void;
        getValue: () => number;
      };

      vm.setProgress(60);
      await nextTick();

      expect(vm.getValue()).toBe(60);
    });

    it("exposes addProgress method", async () => {
      wrapper = await createWrapper({ modelValue: 50 });

      const vm = wrapper.vm as unknown as {
        addProgress: (value: number) => void;
        getValue: () => number;
      };

      vm.addProgress(10);
      await nextTick();

      expect(wrapper.emitted("update:modelValue")![0]).toEqual([60]);
    });

    it("exposes getValue method", async () => {
      wrapper = await createWrapper({ modelValue: 42 });

      const vm = wrapper.vm as unknown as { getValue: () => number };

      expect(vm.getValue()).toBe(42);
    });
  });

  describe("edge cases", () => {
    it("handles decimal step values", async () => {
      wrapper = await createWrapper({
        step: 0.01,
        min: 0,
        max: 1,
        modelValue: 0.5,
      });

      const input = wrapper.find(".range-selector__input");
      expect(input.attributes("step")).toBe("0.01");
    });

    it("handles negative min values", async () => {
      wrapper = await createWrapper({
        min: -100,
        max: 100,
        modelValue: 0,
      });

      const input = wrapper.find(".range-selector__input");
      expect(input.attributes("min")).toBe("-100");
    });

    it("handles same min and max", async () => {
      wrapper = await createWrapper({
        min: 50,
        max: 50,
        modelValue: 50,
      });

      const filled = wrapper.find(".range-selector__filled");
      expect(filled.exists()).toBe(true);
    });

    it("accepts modelValue outside range initially", async () => {
      wrapper = await createWrapper({
        min: 0,
        max: 100,
        modelValue: 150,
      });

      const vm = wrapper.vm as unknown as { getValue: () => number };
      expect(vm.getValue()).toBe(150);
    });
  });
});
