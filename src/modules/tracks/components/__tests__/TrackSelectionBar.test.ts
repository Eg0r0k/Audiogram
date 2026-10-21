import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import TrackSelectionBar from "../TrackSelectionBar.vue";

vi.mock("@/modules/tracks/components/menu/composables/usePlaylistMenu", async () => {
  const { computed, ref } = await import("vue");
  return {
    usePlaylistMenu: () => ({
      playlists: computed(() => [{ id: "pl-1", name: "Mix" }]),
      isLoading: ref(false),
      handleCreatePlaylist: vi.fn(),
    }),
  };
});

const { widthRef } = vi.hoisted(() => ({ widthRef: { value: 1000 } }));

vi.mock("@vueuse/core", async (importOriginal) => {
  const { ref } = await import("vue");
  return {
    ...(await importOriginal<typeof import("@vueuse/core")>()),
    useElementSize: () => ({ width: widthRef, height: ref(0) }),
  };
});

const stubs = {
  Motion: { template: "<div><slot /></div>" },
  MenuTrigger: { template: "<div><slot /></div>" },
  Menu: { template: "<div><slot /></div>" },
  MenuItem: { template: "<button @click=\"$emit('select')\"><slot /></button>" },
  MenuSeparator: { template: "<hr />" },
  MenuLabel: { template: "<div><slot /></div>" },
  TooltipProvider: { template: "<div><slot /></div>" },
  Tooltip: { template: "<div><slot /></div>" },
  TooltipTrigger: { template: "<div><slot /></div>" },
  TooltipContent: true,
};

const renderBar = (props: Partial<InstanceType<typeof TrackSelectionBar>["$props"]> = {}) =>
  render(TrackSelectionBar, {
    props: { count: 0, allSelected: false, allLiked: false, busy: false, selectingAll: false, ...props },
    global: { plugins: [i18n], stubs, directives: { ripple: {} } },
  });

// Each inline action takes 42px and the more button one slot, so 1000px fits
// every action and 130px leaves room for two.
const WIDE = 1000;
const NARROW = 130;

describe("TrackSelectionBar", () => {
  beforeEach(() => {
    widthRef.value = WIDE;
    i18n.global.locale.value = "en";
  });

  it("shows the count as the title, named with the plural string", () => {
    renderBar({ count: 3 });

    expect(screen.getByLabelText("3 tracks selected")).toHaveTextContent("3");
  });

  it("disables every action while nothing is selected but keeps select-all enabled", () => {
    renderBar({ count: 0 });

    for (const name of ["Play", "Play next", "Add to queue", "Create playlist", "Delete"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: "Select all" })).toBeEnabled();
  });

  it("emits every action from its own button when they all fit", async () => {
    const user = userEvent.setup();
    const { emitted } = renderBar({ count: 2 });

    for (const name of ["Play", "Play next", "Add to queue", "Add to favorites", "Create playlist", "Delete", "Exit selection"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveAttribute("data-slot", "button");
      await user.click(button);
    }

    for (const event of ["play", "playNext", "addToQueue", "toggleLike", "createPlaylist", "delete", "exit"]) {
      expect(emitted()[event]).toHaveLength(1);
    }
  });

  it("toggles between select all and deselect all", async () => {
    const user = userEvent.setup();
    const { emitted, rerender } = renderBar({ count: 2, allSelected: false });

    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(emitted().selectAll).toHaveLength(1);

    await rerender({ count: 10, allSelected: true, allLiked: false, busy: false, selectingAll: false });
    await user.click(screen.getByRole("button", { name: "Deselect all" }));
    expect(emitted().deselectAll).toHaveLength(1);
  });

  it("labels the like action by allLiked", () => {
    renderBar({ count: 2, allLiked: true });

    expect(screen.getByRole("button", { name: "Remove from favorites" })).toBeInTheDocument();
  });

  it("adds to an existing playlist from the more menu", async () => {
    const user = userEvent.setup();
    const { emitted } = renderBar({ count: 2 });

    await user.click(screen.getByRole("button", { name: "Mix" }));

    expect(emitted().addToPlaylist).toEqual([["pl-1"]]);
  });

  it("moves the actions that do not fit into the more menu, keeping their order", async () => {
    widthRef.value = NARROW;
    const user = userEvent.setup();
    const { emitted } = renderBar({ count: 2 });

    expect(screen.getByRole("button", { name: "Play" })).toHaveAttribute("data-slot", "button");
    expect(screen.getByRole("button", { name: "Play next" })).toHaveAttribute("data-slot", "button");
    for (const name of ["Add to queue", "Add to favorites", "Create playlist", "Delete"]) {
      const item = screen.getByRole("button", { name });
      expect(item).not.toHaveAttribute("data-slot", "button");
      await user.click(item);
    }

    for (const event of ["addToQueue", "toggleLike", "createPlaylist", "delete"]) {
      expect(emitted()[event]).toHaveLength(1);
    }
  });

  it("keeps select-all next to the count however narrow the bar gets", () => {
    widthRef.value = NARROW;
    renderBar({ count: 1234 });

    expect(screen.getByRole("button", { name: "Select all" })).toHaveAttribute("data-slot", "button");
    expect(screen.getByText("1234")).toBeInTheDocument();
  });
});
