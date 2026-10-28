import { describe, expect, it } from "vitest";
import { selectedRowClass } from "../selection";

const classes = (flags: { selected: boolean; joinTop: boolean; joinBottom: boolean }) =>
  selectedRowClass(flags).split(/\s+/).filter(Boolean);

describe("selectedRowClass", () => {
  it("squares only the joined sides of a selected row", () => {
    const lone = classes({ selected: true, joinTop: false, joinBottom: false });
    expect(lone).toEqual(expect.arrayContaining(["bg-accent/80", "hover:bg-accent/90"]));
    expect(lone).not.toContain("rounded-t-none");
    expect(lone).not.toContain("rounded-b-none");

    const top = classes({ selected: true, joinTop: true, joinBottom: false });
    expect(top).toContain("rounded-t-none");
    expect(top).not.toContain("rounded-b-none");

    const bottom = classes({ selected: true, joinTop: false, joinBottom: true });
    expect(bottom).toContain("rounded-b-none");
    expect(bottom).not.toContain("rounded-t-none");

    const middle = classes({ selected: true, joinTop: true, joinBottom: true });
    expect(middle).toEqual(expect.arrayContaining(["bg-accent/80", "rounded-t-none", "rounded-b-none"]));
  });

  it("returns nothing for an unselected row", () => {
    expect(selectedRowClass({ selected: false, joinTop: false, joinBottom: false })).toBe("");
    expect(selectedRowClass({ selected: false, joinTop: true, joinBottom: true })).toBe("");
  });
});
