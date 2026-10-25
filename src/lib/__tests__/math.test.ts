import { describe, expect, it } from "vitest";
import { indexById, unique } from "../math";

describe("unique", () => {
  it("keeps the first occurrence order in unique", () => {
    const values = ["b", "a", "b", "c", "a"];

    expect(unique(values)).toEqual(["b", "a", "c"]);
    expect(values).toEqual(["b", "a", "b", "c", "a"]);
    expect(unique([])).toEqual([]);
  });
});

describe("indexById", () => {
  it("indexes items by id", () => {
    const first = { id: "a", name: "First" };
    const second = { id: "b", name: "Second" };
    const replacement = { id: "a", name: "Replacement" };

    const byId = indexById([first, second]);
    expect(byId.size).toBe(2);
    expect(byId.get("a")).toBe(first);
    expect(byId.get("b")).toBe(second);
    expect(byId.get("c")).toBeUndefined();

    const withDuplicate = indexById([first, second, replacement]);
    expect([...withDuplicate.keys()]).toEqual(["a", "b"]);
    expect(withDuplicate.get("a")).toBe(replacement);
  });
});
