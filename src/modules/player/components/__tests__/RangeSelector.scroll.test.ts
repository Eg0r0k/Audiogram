import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createI18n } from "vue-i18n";
import { messages } from "@/app/i18n/messages";
import RangeSelector from "../RangeSelector.vue";

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

describe("RangeSelector - scroll", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not re-measure itself when a list elsewhere scrolls", async () => {
    const list = document.createElement("div");
    document.body.append(list);
    const wrapper = mount(RangeSelector, {
      attachTo: document.body,
      global: { plugins: [createI18n({ legacy: false, locale: "en", messages })] },
    });
    await nextFrame();
    await nextFrame();

    const measure = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect");
    list.dispatchEvent(new Event("scroll"));
    await nextFrame();
    await nextFrame();

    expect(measure).not.toHaveBeenCalled();
    wrapper.unmount();
    list.remove();
  });
});
