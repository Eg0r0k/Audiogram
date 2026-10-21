import { afterEach, describe, expect, it } from "vitest";
import { toaster } from "@/app/toaster";

const record = (id: string) => toaster.toasts.value.find(toast => toast.id === id);

describe("toaster", () => {
  afterEach(() => {
    toaster.clear();
  });

  it("keeps an error until it is closed", () => {
    const id = toaster.add({ title: "Could not save", color: "destructive" });

    expect(record(id)).toMatchObject({ duration: 0, close: true });
  });

  it("keeps a toast with an action until it is closed", () => {
    const id = toaster.add({ title: "Deleted", color: "success", actions: [{ label: "Undo" }] });

    expect(record(id)).toMatchObject({ duration: 0, close: true });
  });

  it("does not let an explicit duration time an error out", () => {
    const id = toaster.add({ title: "Could not save", color: "destructive", duration: 5000 });

    expect(record(id)?.duration).toBe(0);
  });

  it("lets a plain notice close on its own", () => {
    const id = toaster.add({ title: "Copied", color: "success" });

    expect(record(id)?.duration).toBeUndefined();
    expect(record(id)?.close).toBeUndefined();
  });
});
