import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { createI18n } from "vue-i18n";
import { messages } from "@/app/i18n/messages";
import RangeSelector from "../RangeSelector.vue";

const chapters = [
  { time: 0, title: "Intro" },
  { time: 50, title: "Verse" },
  { time: 75, title: "Outro" },
];

function mountBar(modelValue: number) {
  return mount(RangeSelector, {
    props: { step: 0.01, duration: 100, chapters, modelValue },
    global: { plugins: [createI18n({ legacy: false, locale: "en", messages })] },
  });
}

const fills = (wrapper: ReturnType<typeof mountBar>) =>
  wrapper.findAll(".range-selector__filled").map(f => (f.element as HTMLElement).style.transform);

describe("RangeSelector - chapter segments", () => {
  it("gives every segment its own fill, so gaps stay empty behind the played part", async () => {
    const wrapper = mountBar(60);
    await nextTick();

    expect(wrapper.findAll(".range-selector__segment")).toHaveLength(3);
    // Fills live inside the segments, none spans the gaps.
    expect(wrapper.findAll(".range-selector__segment > .range-selector__filled")).toHaveLength(3);
    expect(fills(wrapper)).toEqual(["scaleX(1)", "scaleX(0.4)", "scaleX(0)"]);
    wrapper.unmount();
  });

  it("repaints the fills when the chapter list changes", async () => {
    const wrapper = mountBar(60);
    await nextTick();

    await wrapper.setProps({ chapters: [] });
    await nextTick();
    expect(fills(wrapper)).toEqual(["scaleX(0.6)"]);
    wrapper.unmount();
  });

  it("insets segments by the gap only when there are chapters", async () => {
    const wrapper = mountBar(0);
    await nextTick();
    const [first] = wrapper.findAll(".range-selector__segment");
    expect((first.element as HTMLElement).style.left).toBe("calc(0% + 2px)");

    await wrapper.setProps({ chapters: [] });
    await nextTick();
    const [only] = wrapper.findAll(".range-selector__segment");
    expect((only.element as HTMLElement).style.width).toBe("calc(100% - 0px)");
    wrapper.unmount();
  });
});
