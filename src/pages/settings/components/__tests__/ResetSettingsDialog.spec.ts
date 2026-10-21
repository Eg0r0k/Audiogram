import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { screen, fireEvent } from "@testing-library/vue";
import ResetSettingsDialog from "@/pages/settings/components/ResetSettingsDialog.vue";
import { closeDialogs, openForResult, renderDialogHost } from "@/test/dialogs";

const renderHost = renderDialogHost;

function resetButton() {
  return screen.getByRole("button", { name: /^reset( \(\d\))?$/i }) as HTMLButtonElement;
}

describe("ResetSettingsDialog (summoned)", () => {
  beforeEach(() => {
    // Only the countdown interval is faked — real setTimeout still flushes
    // the reka portal and the summon teardown delay.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  });

  afterEach(async () => {
    await closeDialogs();
    vi.useRealTimers();
  });

  it("disables the reset button while the countdown runs", async () => {
    renderHost();
    openForResult<boolean>(ResetSettingsDialog);
    await nextTick();
    await screen.findByRole("button", { name: /reset/i });

    expect(resetButton().disabled).toBe(true);
    expect(resetButton().textContent).toContain("(3)");
  });

  it("enables the reset button and resolves true after the countdown", async () => {
    renderHost();
    const promise = openForResult<boolean>(ResetSettingsDialog);
    await nextTick();
    await screen.findByRole("button", { name: /reset/i });

    vi.advanceTimersByTime(3000);
    await nextTick();

    expect(resetButton().disabled).toBe(false);
    await fireEvent.click(resetButton());
    await expect(promise).resolves.toBe(true);
  });

  it("resolves undefined when cancelled during the countdown", async () => {
    renderHost();
    const promise = openForResult<boolean>(ResetSettingsDialog);
    await nextTick();
    await screen.findByRole("button", { name: "Cancel" });

    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await expect(promise).resolves.toBeUndefined();
  });
});
