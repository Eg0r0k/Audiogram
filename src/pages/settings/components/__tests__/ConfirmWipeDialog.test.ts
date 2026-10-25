import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { fireEvent, screen } from "@testing-library/vue";
import ConfirmWipeDialog from "@/pages/settings/components/ConfirmWipeDialog.vue";
import { closeDialogs, openForResult, renderDialogHost } from "@/test/dialogs";

const texts = {
  title: "Delete all data?",
  description: "Everything goes.",
  confirmLabel: "Delete everything",
  failedText: "Couldn't delete the data",
};

const summon = (run: () => Promise<void> = async () => {}) =>
  openForResult<true>(ConfirmWipeDialog, { ...texts, run });

const confirmButton = () => screen.getByRole("button", { name: /delete everything|retry/i }) as HTMLButtonElement;

const openAndWaitOutCountdown = async (run?: () => Promise<void>) => {
  renderDialogHost();
  const promise = summon(run);
  await nextTick();
  await screen.findByRole("button", { name: /delete everything/i });
  vi.advanceTimersByTime(3000);
  await nextTick();
  // Wrapped: returning the bare promise would make the caller await the dialog.
  return { promise };
};

const settle = async () => {
  await nextTick();
  await nextTick();
};

describe("ConfirmWipeDialog", () => {
  beforeEach(() => {
    // Only the countdown interval is faked: real setTimeout still flushes
    // the reka portal and the summon teardown delay.
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  });

  afterEach(async () => {
    await closeDialogs();
    vi.useRealTimers();
  });

  it("names the action and disables it while the countdown runs", async () => {
    renderDialogHost();
    summon();
    await nextTick();
    await screen.findByRole("button", { name: /delete everything/i });

    expect(screen.getByText("Delete all data?")).toBeInTheDocument();
    expect(screen.getByText("Everything goes.")).toBeInTheDocument();
    expect(confirmButton().disabled).toBe(true);
    expect(confirmButton().textContent).toContain("(3)");
  });

  it("enables the action after 3 seconds", async () => {
    await openAndWaitOutCountdown();

    expect(confirmButton().disabled).toBe(false);
    expect(confirmButton().textContent).not.toContain("(");
  });

  it("runs the action on confirm and resolves once it succeeded", async () => {
    let release!: () => void;
    const run = vi.fn(() => new Promise<void>((resolve) => {
      release = resolve;
    }));
    const { promise } = await openAndWaitOutCountdown(run);
    await fireEvent.click(confirmButton());

    expect(run).toHaveBeenCalledTimes(1);
    expect(confirmButton().disabled).toBe(true);

    release();
    await expect(promise).resolves.toBe(true);
  });

  it("shows the failure next to the action and offers a retry", async () => {
    const run = vi.fn()
      .mockRejectedValueOnce(new Error("disk"))
      .mockResolvedValueOnce(undefined);
    const { promise } = await openAndWaitOutCountdown(run);
    await fireEvent.click(confirmButton());
    await settle();

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't delete the data");
    expect(confirmButton().textContent).toContain("Retry");
    expect(confirmButton().disabled).toBe(false);

    await fireEvent.click(confirmButton());
    await expect(promise).resolves.toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("resolves undefined when cancelled", async () => {
    renderDialogHost();
    const promise = summon();
    await nextTick();
    await screen.findByRole("button", { name: "Cancel" });

    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await expect(promise).resolves.toBeUndefined();
  });
});
