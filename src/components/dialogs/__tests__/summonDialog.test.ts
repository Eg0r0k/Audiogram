import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { render, screen, fireEvent } from "@testing-library/vue";
import { createI18n } from "vue-i18n";
import { messages } from "@/app/i18n/messages";
import { DialogSummonHost, dismissAllSummonedDialogs } from "../summon";
import { summonDialog } from "../summonDialog";

const renderHost = () => render(DialogSummonHost, {
  global: {
    plugins: [createI18n({ legacy: false, locale: "en", messages })],
    stubs: { teleport: false },
  },
});

describe("summonDialog (by registry key)", () => {
  afterEach(async () => {
    dismissAllSummonedDialogs();
    await new Promise(resolve => setTimeout(resolve, 350));
  });

  it("mounts the registered component and resolves with its typed result", async () => {
    renderHost();
    const promise = summonDialog("deleteTrack", { trackTitle: "I Am a God" }, { key: "t" });
    await nextTick();

    expect(await screen.findByText(/I Am a God/)).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await expect(promise).resolves.toEqual({ dontAskAgain: false });
  });

  it("dedupes by key like the component-level summon", async () => {
    renderHost();
    const first = summonDialog("deleteTracks", { count: 2 }, { key: "same" });
    const second = summonDialog("deleteTracks", { count: 3 }, { key: "same" });
    expect(first).toBe(second);
  });
});
