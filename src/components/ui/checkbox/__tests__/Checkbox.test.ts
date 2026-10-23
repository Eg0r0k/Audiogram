import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { Checkbox } from "@/components/ui/checkbox";

// A list in select mode mounts a checkbox per row on every scroll step; a
// computed-style read on mount is a forced style recalc per row.

enableAutoUnmount(afterEach);

afterEach(() => {
  vi.restoreAllMocks();
});

const mountCheckbox = (modelValue: boolean | "indeterminate") => mount(Checkbox, { props: { modelValue } });

describe("Checkbox", () => {
  it("mounts without reading computed style", async () => {
    const reads = vi.spyOn(window, "getComputedStyle");

    mountCheckbox(true);
    mountCheckbox(false);
    await flushPromises();
    await nextTick();

    expect(reads).not.toHaveBeenCalled();
  });

  it("exposes checked, unchecked and indeterminate on the root data-state", () => {
    const stateOf = (modelValue: boolean | "indeterminate") =>
      mountCheckbox(modelValue).get("[data-slot=checkbox]").attributes("data-state");

    expect(stateOf(true)).toBe("checked");
    expect(stateOf(false)).toBe("unchecked");
    expect(stateOf("indeterminate")).toBe("indeterminate");
  });

  it("still toggles through v-model", async () => {
    const wrapper = mount(Checkbox, {
      props: {
        modelValue: false,
        "onUpdate:modelValue": (value: boolean | "indeterminate") => wrapper.setProps({ modelValue: value }),
      },
    });
    const root = wrapper.get("[data-slot=checkbox]");

    await root.trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([[true]]);
    expect(root.attributes("data-state")).toBe("checked");

    await root.trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([[true], [false]]);
    expect(root.attributes("data-state")).toBe("unchecked");
  });
});
