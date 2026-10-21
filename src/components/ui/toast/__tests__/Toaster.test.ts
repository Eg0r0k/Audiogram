import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ToastProvider } from "reka-ui";
import { i18n } from "@/app/i18n";
import { Toaster, type Toasts, createToaster } from "@/components/ui/toast";

let wrapper: VueWrapper | undefined;

const mountToaster = (props: Record<string, unknown> = {}): Toasts => {
  const toaster = createToaster();
  wrapper = mount(Toaster, { props, attachTo: document.body, global: { plugins: [toaster, i18n], stubs: { teleport: false } } });
  return toaster;
};

const isOpen = (toaster: Toasts, id: string) => toaster.toasts.value.find(toast => toast.id === id)?.open === true;

describe("Toaster", () => {
  beforeEach(() => {
    i18n.global.locale.value = "ru";
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("makes room by closing a toast that would close on its own, never one waiting for the user", async () => {
    const toaster = mountToaster({ max: 2 });
    const error = toaster.add({ title: "Could not save", duration: 0, close: true });
    const copied = toaster.add({ title: "Copied" });
    const saved = toaster.add({ title: "Saved" });
    await flushPromises();

    expect(isOpen(toaster, error)).toBe(true);
    expect(isOpen(toaster, copied)).toBe(false);
    expect(isOpen(toaster, saved)).toBe(true);
  });

  it("keeps every toast waiting for the user even past the limit", async () => {
    const toaster = mountToaster({ max: 1 });
    const first = toaster.add({ title: "Could not save", duration: 0, close: true });
    const second = toaster.add({ title: "Could not delete", duration: 0, close: true });
    await flushPromises();

    expect(isOpen(toaster, first)).toBe(true);
    expect(isOpen(toaster, second)).toBe(true);
  });

  it("labels the close button in the app language", async () => {
    const toaster = mountToaster();
    toaster.add({ title: "Could not save", close: true });
    await flushPromises();

    expect(document.querySelector("[data-slot=toast-close]")?.getAttribute("aria-label")).toBe("Закрыть");
  });

  it("names the toast region and each toast in the app language", async () => {
    const toaster = mountToaster();
    toaster.add({ title: "Could not save" });
    await flushPromises();

    expect(document.querySelector("[role=region]")?.getAttribute("aria-label")).toBe("Уведомления (F8)");
    expect(wrapper?.findComponent(ToastProvider).props("label")).toBe("Уведомление");
  });

  it("tints the icon with the toast's tone", async () => {
    const toaster = mountToaster();
    toaster.add({ title: "Could not save", color: "destructive" });
    await flushPromises();

    expect(document.querySelector("[data-slot=toast-icon]")?.classList).toContain("text-tone-text");
  });

  it("picks the status icon from the toast's color, and none for a neutral toast", async () => {
    const toaster = mountToaster();
    toaster.add({ title: "Saved", color: "success" });
    toaster.add({ title: "Could not save", color: "destructive" });
    toaster.add({ title: "Read only", color: "warning" });
    toaster.add({ title: "Copied" });
    await flushPromises();

    const statuses = [...document.querySelectorAll("[data-slot=toast-icon]")].map(el => el.getAttribute("data-status"));

    expect(statuses.sort()).toEqual(["error", "success", "warning"]);
  });
});
