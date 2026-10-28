import { render } from "@testing-library/vue";
import { describe, expect, it, vi } from "vitest";
import { TrackSource, TrackState } from "@/db/entities";
import type { Track } from "@/types/track";
import { SELECTED_ROW_CLASS } from "@/components/common/row-selection";

vi.mock("@/modules/covers/composables/useTrackCover", async () => {
  const { shallowRef } = await import("vue");
  return { useTrackCover: () => ({ url: shallowRef<string | undefined>(undefined) }) };
});

import TrackSelectRow from "../TrackSelectRow.vue";

const track: Track = {
  kind: "library",
  id: "t1" as Track["id"],
  title: "Glory Box",
  artist: "Portishead",
  artistIds: ["ar1" as Track["artistIds"][number]],
  albumId: "al1" as Track["albumId"],
  albumName: "Dummy",
  storagePath: "tracks/t1.mp3",
  source: TrackSource.LOCAL_INTERNAL,
  state: TrackState.READY,
  duration: 100,
  isLiked: false,
};

const renderRow = (props: Record<string, unknown>) => render(TrackSelectRow, {
  props: { track, ...props },
  global: {
    directives: { ripple: {} },
    stubs: { NuxtImage: true },
  },
});

const rowOf = (container: Element) => container.querySelector<HTMLElement>("[data-track-id]")!;

describe("TrackSelectRow", () => {
  it("paints a selected row with the shared selection class and squares the joined sides", () => {
    const { container } = renderRow({ isSelected: true, joinTop: true, joinBottom: false });
    const row = rowOf(container);

    for (const name of SELECTED_ROW_CLASS.split(" ")) expect(row).toHaveClass(name);
    expect(row).toHaveClass("rounded-t-none");
    expect(row).not.toHaveClass("rounded-b-none");
  });

  it("keeps the title colour on a selected row", () => {
    const { getByText } = renderRow({ isSelected: true });

    expect(getByText("Glory Box")).not.toHaveClass("text-primary");
  });
});
