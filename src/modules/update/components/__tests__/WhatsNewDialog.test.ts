import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { ref, type Ref } from "vue";
import { i18n } from "@/app/i18n";
import { useChangelogStore } from "../../store/changelog.store";
import type { ReleaseNotesStatus } from "../../composables/useReleaseNotesDialog";
import WhatsNewDialog from "../WhatsNewDialog.vue";

interface DialogState {
  version: Ref<string>;
  status: Ref<ReleaseNotesStatus>;
  body: Ref<string>;
  publishedAt: Ref<Date | null>;
  releaseUrl: Ref<string>;
  releasesUrl: string;
  retry: () => Promise<void>;
}

const mocks = await vi.hoisted(async () => {
  const { ref: vueRef } = await import("vue");
  return {
    dialog: null as unknown as DialogState,
    isMobileLayout: vueRef(false),
  };
});

vi.mock("../../composables/useReleaseNotesDialog", () => ({
  useReleaseNotesDialog: () => mocks.dialog,
}));

vi.mock("@/composables/useDeviceLayout", async () => {
  const { computed } = await import("vue");
  return {
    useDeviceLayout: () => ({
      isMobileLayout: mocks.isMobileLayout,
      isDesktopLayout: computed(() => !mocks.isMobileLayout.value),
      layoutType: computed(() => (mocks.isMobileLayout.value ? "mobile" : "desktop")),
    }),
  };
});

const VERSION = "0.2.18";
const RELEASE_URL = "https://github.com/owner/app/releases/tag/v0.2.18";
const RELEASES_URL = "https://github.com/owner/app/releases";
const NOTES = "## New features\n- **Queue** - Drag to reorder\n\n## Fixes\n- **Seek** - No longer jumps";

const renderDialog = (state: Partial<Omit<DialogState, "releasesUrl" | "retry">> & { retry?: () => Promise<void> } = {}) => {
  mocks.dialog = {
    version: ref(VERSION),
    status: ref<ReleaseNotesStatus>("ready"),
    body: ref(NOTES),
    publishedAt: ref<Date | null>(null),
    releaseUrl: ref(RELEASE_URL),
    releasesUrl: RELEASES_URL,
    retry: vi.fn(async () => {}),
    ...state,
  };
  useChangelogStore().openDialog(VERSION);
  return render(WhatsNewDialog, { global: { plugins: [i18n], stubs: { teleport: false } } });
};

const dialogContent = () => document.querySelector<HTMLElement>("[data-slot=\"dialog-content\"]");
const drawerContent = () => document.querySelector<HTMLElement>("[data-slot=\"drawer-content\"]");
const notesRoot = () => document.querySelector<HTMLElement>(".release-notes-markdown");

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
});

// A drawer unmounted while open leaves a closing copy in the body.
beforeEach(() => {
  document.body.innerHTML = "";
  i18n.global.locale.value = "en";
  mocks.isMobileLayout.value = false;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WhatsNewDialog", () => {
  it("shows the version in the title and the release date under it", async () => {
    const publishedAt = new Date(2026, 9, 24, 12);
    renderDialog({ publishedAt: ref<Date | null>(publishedAt) });

    const title = await screen.findByRole("heading", { name: "What's new in 0.2.18" });
    const date = screen.getByText("October 24, 2026");
    expect(date.tagName).toBe("TIME");
    expect(date).toHaveAttribute("datetime", publishedAt.toISOString());
    expect(title.compareDocumentPosition(date) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(date.closest("header")).toBe(title.closest("header"));
    expect(screen.queryByText("Changes included in this release.")).toBeNull();

    i18n.global.locale.value = "ru";
    const russianDate = new Intl.DateTimeFormat("ru", { dateStyle: "long" }).format(publishedAt);
    const russianTitle = i18n.global.t("update.whatsNewIn", { version: VERSION });

    expect(russianTitle).not.toBe("What's new in 0.2.18");
    expect(await screen.findByText(russianDate)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: russianTitle })).toBeInTheDocument();
  });

  it("shows no date while the release date is unknown", async () => {
    renderDialog();

    await screen.findByRole("heading", { name: "What's new in 0.2.18" });
    expect(document.querySelector("time")).toBeNull();
  });

  it("puts the close button in the header row", async () => {
    renderDialog();

    const title = await screen.findByRole("heading", { name: "What's new in 0.2.18" });
    const header = title.closest("header");
    expect(header).not.toBeNull();
    const close = within(header!).getByRole("button", { name: "Close" });
    expect(screen.getAllByRole("button", { name: "Close" })).toEqual([close]);

    await fireEvent.click(close);

    expect(useChangelogStore().isDialogOpen).toBe(false);
  });

  it("focuses the dialog, not the close button, when it opens", async () => {
    for (const mobile of [false, true]) {
      mocks.isMobileLayout.value = mobile;
      const opener = document.createElement("button");
      document.body.append(opener);
      opener.focus();
      const { unmount } = renderDialog();
      const surface = () => (mobile ? drawerContent() : dialogContent());

      await screen.findByRole("heading", { name: "What's new in 0.2.18" });
      await vi.waitFor(() => expect(document.activeElement).toBe(surface()));
      expect(surface()).toHaveAttribute("tabindex", "-1");

      await userEvent.tab();

      const close = screen.getByRole("button", { name: "Close" });
      expect(document.activeElement).toBe(close);

      await fireEvent.click(close);

      await vi.waitFor(() => expect(document.activeElement).toBe(opener));
      unmount();
      opener.remove();
    }
  });

  it("shows a skeleton while the notes load", async () => {
    renderDialog({ status: ref<ReleaseNotesStatus>("loading"), body: ref("") });

    const loading = await screen.findByRole("status");
    expect(loading).toHaveTextContent("Loading release notes");
    expect(loading.querySelectorAll("[data-slot=\"skeleton\"]").length).toBeGreaterThan(3);
    expect(dialogContent()).toHaveAttribute("data-status", "loading");
    expect(notesRoot()).toBeNull();
    expect(screen.queryByRole("link", { name: "View release on GitHub" })).toBeNull();

    const header = screen.getByRole("heading", { name: "What's new in 0.2.18" }).closest("header")!;
    const dateLine = header.querySelector("[data-slot=\"skeleton\"]");
    expect(dateLine).not.toBeNull();
    expect(header.querySelector("time")).toBeNull();

    mocks.dialog.status.value = "ready";
    mocks.dialog.body.value = NOTES;
    mocks.dialog.publishedAt.value = new Date(2026, 9, 24, 12);

    expect(await screen.findByText("October 24, 2026")).toBeInTheDocument();
    expect(header.querySelector("[data-slot=\"skeleton\"]")).toBeNull();
  });

  it("offers Try again and GitHub when the notes failed to load", async () => {
    const retry = vi.fn(async () => {});
    renderDialog({ status: ref<ReleaseNotesStatus>("error"), body: ref(""), retry });

    expect(await screen.findByText("Couldn't load release notes")).toBeInTheDocument();
    expect(screen.getByText("Check your connection and try again.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open on GitHub" })).toHaveAttribute("href", RELEASE_URL);
    expect(dialogContent()).toHaveAttribute("data-status", "error");

    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("shows the empty state with a link to the releases", async () => {
    renderDialog({ status: ref<ReleaseNotesStatus>("empty"), body: ref("") });

    expect(await screen.findByText("No release notes for 0.2.18 yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See all releases on GitHub" })).toHaveAttribute("href", RELEASES_URL);
    expect(notesRoot()).toBeNull();

    mocks.dialog.status.value = "ready";
    mocks.dialog.body.value = "<!-- Release notes go here -->";

    expect(await screen.findByText("No release notes for 0.2.18 yet")).toBeInTheDocument();
    expect(notesRoot()).toBeNull();
    expect(screen.queryByText("Release notes go here")).toBeNull();
  });

  it("renders the notes and ends with a link to the release", async () => {
    renderDialog();

    const section = await screen.findByRole("heading", { name: "New features" });
    expect(section).toHaveAttribute("data-kind", "feat");
    expect(screen.getByRole("heading", { name: "Fixes" })).toHaveAttribute("data-kind", "fix");
    expect(screen.getByText("Queue")).toHaveClass("rn-title");
    expect(screen.getByText("Drag to reorder")).toHaveClass("rn-desc");
    expect(dialogContent()).toHaveAttribute("data-status", "ready");

    const link = screen.getByRole("link", { name: "View release on GitHub" });
    expect(link).toHaveAttribute("href", RELEASE_URL);
    expect(notesRoot()!.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notesRoot()!.contains(link)).toBe(false);
  });

  it("labels an image that failed to load", async () => {
    renderDialog({ body: ref("![Queue drag](https://example.com/hero.png)\n\n## Fixes\n- **Seek** - No longer jumps") });

    const image = await screen.findByAltText("Queue drag");
    const media = image.closest<HTMLElement>(".rn-media")!;
    expect(media).not.toHaveAttribute("data-failed");

    image.dispatchEvent(new Event("error"));

    expect(media).toHaveAttribute("data-failed");
    expect(within(media).getByText("Image didn't load")).toBeInTheDocument();

    image.dispatchEvent(new Event("error"));

    expect(within(media).getAllByText("Image didn't load")).toHaveLength(1);
  });

  it("labels an image that failed before the notes mounted", async () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    renderDialog({ body: ref("## Improvements\n- **Covers** - Sharper\n  ![Covers](https://example.com/covers.png)") });

    const image = await screen.findByAltText("Covers");
    const media = image.closest<HTMLElement>(".rn-media")!;

    await vi.waitFor(() => expect(media).toHaveAttribute("data-failed"));
    expect(within(media).getByText("Image didn't load")).toBeInTheDocument();
  });

  it("uses a drawer on the phone layout", async () => {
    mocks.isMobileLayout.value = true;
    renderDialog();

    const title = await screen.findByRole("heading", { name: "What's new in 0.2.18" });
    expect(drawerContent()).not.toBeNull();
    expect(drawerContent()!.contains(title)).toBe(true);
    expect(dialogContent()).toBeNull();
    expect(screen.getByRole("link", { name: "View release on GitHub" })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(useChangelogStore().isDialogOpen).toBe(false);
  });
});
