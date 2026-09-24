import { mount } from "@vue/test-utils";
import { motion, mountedStates } from "motion-v";
import { Transition, defineComponent, h, nextTick, ref } from "vue";
import { describe, expect, it } from "vitest";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// A page leaving through a plain <Transition> stays in the DOM while its
// motion children unmount. motion-v skipped their teardown then and never
// came back, so every row with a drag or layout feature kept its window
// listeners and its DOM alive after navigation.
describe("motion-v patch: teardown after a leave transition", () => {
  it("unmounts the motion state once the leaving element is removed", async () => {
    const show = ref(true);
    const Page = defineComponent({
      setup: () => () => h(motion.div, { class: "row", drag: "x" }),
    });
    const wrapper = mount(defineComponent({
      setup: () => () => h(Transition, { duration: 30 }, () => (show.value ? h(Page) : null)),
    }), { attachTo: document.body, global: { stubs: { transition: false } } });
    await nextTick();
    const row = wrapper.find(".row").element;
    expect(mountedStates.has(row)).toBe(true);

    show.value = false;
    await nextTick();
    expect(row.isConnected).toBe(true);

    await wait(300);
    expect(row.isConnected).toBe(false);
    expect(mountedStates.has(row)).toBe(false);
    wrapper.unmount();
  });

  it("still unmounts at once an element that leaves without a transition", async () => {
    const show = ref(true);
    const wrapper = mount(defineComponent({
      setup: () => () => (show.value ? h(motion.div, { class: "row" }) : null),
    }), { attachTo: document.body });
    await nextTick();
    const row = wrapper.find(".row").element;

    show.value = false;
    await nextTick();
    expect(mountedStates.has(row)).toBe(false);
    wrapper.unmount();
  });
});
