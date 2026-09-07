import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { fireEvent, render, screen } from "@testing-library/vue";
import { createI18n } from "vue-i18n";
import { messages } from "@/app/i18n/messages";
import ClearAllDataDialog from "@/pages/settings/components/ClearAllDataDialog.vue";
import { DialogSummonHost, dismissAllSummonedDialogs, summonComponent } from "@/components/dialogs/summon";

const stats = { tracksCount: 10, albumsCount: 2, artistsCount: 3, totalUsed: "1.2 GB" };

const renderHost = () => render(DialogSummonHost, {
  global: {
    plugins: [createI18n({ legacy: false, locale: "en", messages })],
    stubs: { teleport: false },
  },
});

const summon = (clear: () => Promise<void> = async () => {}) =>
  summonComponent<true>(ClearAllDataDialog, { stats, clear });

function deleteButton() {
  return screen.getByRole("button", { name: /delete everything/i }) as HTMLButtonElement;
}

describe("ClearAllDataDialog (summoned)", () => {
  beforeEach(() => {
    // Only the countdown interval is faked — real setTimeout still flushes
    // the reka portal and the summon teardown delay.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  });

  afterEach(async () => {
    dismissAllSummonedDialogs();
    await new Promise(resolve => setTimeout(resolve, 350));
    vi.useRealTimers();
  });

  it("disables the delete button while the countdown runs", async () => {
    renderHost();
    summon();
    await nextTick();
    await screen.findByRole("button", { name: /delete everything/i });

    expect(deleteButton().disabled).toBe(true);
    expect(deleteButton().textContent).toContain("(3)");
  });

  it("enables the delete button after 3 seconds", async () => {
    renderHost();
    summon();
    await nextTick();
    await screen.findByRole("button", { name: /delete everything/i });

    vi.advanceTimersByTime(3000);
    await nextTick();

    expect(deleteButton().disabled).toBe(false);
    expect(deleteButton().textContent).not.toContain("(");
  });

  it("runs the action on confirm and resolves once it succeeded", async () => {
    renderHost();
    let release!: () => void;
    const clear = vi.fn(() => new Promise<void>((resolve) => {
      release = resolve;
    }));
    const promise = summon(clear);
    await nextTick();
    await screen.findByRole("button", { name: /delete everything/i });

    vi.advanceTimersByTime(3000);
    await nextTick();
    await fireEvent.click(deleteButton());

    expect(clear).toHaveBeenCalledTimes(1);
    // Pending: still open, the button locked, the promise unsettled.
    expect(deleteButton().disabled).toBe(true);

    release();
    await expect(promise).resolves.toBe(true);
  });

  it("stays open for a retry when the action fails", async () => {
    renderHost();
    const clear = vi.fn(() => Promise.reject(new Error("disk")));
    summon(clear);
    await nextTick();
    await screen.findByRole("button", { name: /delete everything/i });

    vi.advanceTimersByTime(3000);
    await nextTick();
    await fireEvent.click(deleteButton());
    await nextTick();
    await nextTick();

    expect(clear).toHaveBeenCalledTimes(1);
    expect(deleteButton().disabled).toBe(false);
  });

  it("resolves undefined when cancelled", async () => {
    renderHost();
    const promise = summon();
    await nextTick();
    await screen.findByRole("button", { name: "Cancel" });

    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await expect(promise).resolves.toBeUndefined();
  });
});
