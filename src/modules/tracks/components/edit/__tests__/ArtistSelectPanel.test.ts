import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { VueQueryPlugin } from "@tanstack/vue-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import ArtistSelectPanel from "../ArtistSelectPanel.vue";

const queries = vi.hoisted(() => ({ searchArtists: vi.fn() }));
vi.mock("@/queries/artist.queries", () => queries);
vi.mock("@/components/ui/EntityCoverImage.vue", () => ({ default: { template: "<span />" } }));

const stubs = {
  RightPanelHeader: { template: "<div />" },
  VirtualScrollable: {
    props: ["items"],
    methods: { scrollToIndex: vi.fn() },
    template: `<div><template v-for="(item, index) in items" :key="index"><slot :item="item" :index="index" /></template></div>`,
  },
  AddFloatingButton: {
    props: ["count", "show"],
    emits: ["click"],
    template: `<button v-if="show" data-testid="fab" @click="$emit('click')">{{ count }}</button>`,
  },
};

const artists = [
  { id: "a1", name: "Alpha", pinned: 1, addedAt: 0, updatedAt: 0 },
  { id: "a2", name: "Beta", pinned: 1, addedAt: 0, updatedAt: 0 },
];

const renderPanel = (selectedNames: string[], onConfirm = vi.fn()) => {
  render(ArtistSelectPanel, {
    props: { payload: { kind: "artists", selectedNames, onConfirm, onDone: vi.fn() } },
    global: { plugins: [i18n, VueQueryPlugin], stubs },
  });
  return onConfirm;
};

describe("ArtistSelectPanel", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    queries.searchArtists.mockResolvedValue(artists);
  });

  it("offers confirm only once the selection differs from the track's artists", async () => {
    renderPanel(["Alpha"]);
    await screen.findByText("Alpha");
    expect(screen.queryByTestId("fab")).toBeNull();

    await userEvent.click(screen.getByText("Beta"));
    expect(screen.getByTestId("fab")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Beta"));
    expect(screen.queryByTestId("fab")).toBeNull();
  });

  it("lets the last artist be removed", async () => {
    const onConfirm = renderPanel(["Alpha"]);
    await screen.findByText("Alpha");

    await userEvent.click(screen.getByText("Alpha"));
    await userEvent.click(screen.getByTestId("fab"));

    expect(onConfirm).toHaveBeenCalledWith({ names: [] });
  });
});
