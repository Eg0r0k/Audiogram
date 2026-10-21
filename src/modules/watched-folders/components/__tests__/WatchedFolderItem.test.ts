import { fireEvent, render, screen } from "@testing-library/vue";
import { beforeEach, describe, expect, it } from "vitest";
import { i18n } from "@/app/i18n";
import type { WatchedFolder } from "@/types/watched-folders";
import WatchedFolderItem from "../WatchedFolderItem.vue";

const folder = (overrides: Partial<WatchedFolder> = {}): WatchedFolder => ({
  id: "f1",
  path: "D:/Music",
  name: "Music",
  addedAt: 0,
  lastScanAt: null,
  fileCount: 12,
  status: "watching",
  ...overrides,
});

const renderItem = (value: WatchedFolder) => render(WatchedFolderItem, {
  props: { folder: value },
  global: { plugins: [i18n] },
});

describe("WatchedFolderItem", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
  });

  it("says a missing folder is gone instead of showing its old track count", () => {
    renderItem(folder({ status: "missing", errorMessage: "Folder not found" }));

    expect(screen.getByText("Folder is no longer available")).toBeInTheDocument();
    expect(screen.queryByText(/12 tracks/)).toBeNull();
  });

  it("offers to relink a missing folder right in the row", async () => {
    const { emitted } = renderItem(folder({ status: "missing" }));

    await fireEvent.click(screen.getByRole("button", { name: "Relink" }));

    expect(emitted().relink).toEqual([["f1"]]);
  });

  it("does not offer a relink for a folder that is there", () => {
    renderItem(folder());

    expect(screen.queryByRole("button", { name: "Relink" })).toBeNull();
  });
});
