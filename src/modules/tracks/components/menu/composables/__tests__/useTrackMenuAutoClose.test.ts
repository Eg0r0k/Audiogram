import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, reactive, shallowRef, type Ref } from "vue";
import { mount } from "@vue/test-utils";
import { QueryClient } from "@tanstack/vue-query";
import { db } from "@/db";
import { removeTrackFromPlaylistAndSync } from "@/queries/playlist.queries";
import type { Track } from "@/types/track";
import { PlaylistId, QueueItemId, TrackId } from "@/types/ids";

const queueState = reactive({
  queue: [] as { id: QueueItemId }[],
});

vi.mock("@/modules/queue/store/queue.store", () => ({
  useQueueStore: () => queueState,
}));

import { useTrackMenu } from "@/modules/tracks/composables/useTrackMenu";
import { useTrackMenuAutoClose } from "../useTrackMenuAutoClose";
import type { TrackContext } from "../../type";

const PLAYLIST_ID = PlaylistId("playlist-1");

function makeTrack(id = "track-1"): Track {
  return {
    kind: "library",
    id: TrackId(id),
    title: "Test track",
    artist: "Test artist",
    artistIds: [],
    albumId: "album-1",
    albumName: "Test album",
    storagePath: "music/test.mp3",
    source: 0,
    state: 0,
    duration: 100,
    isLiked: false,
  } as unknown as Track;
}

function mountAutoClose(isOpen: Ref<boolean>, context: TrackContext) {
  return mount(defineComponent({
    setup() {
      useTrackMenuAutoClose(isOpen, {
        context,
        playlistId: () => (context === "playlist" ? PLAYLIST_ID : undefined),
      });
      return () => h("div");
    },
  }));
}

const quiet = () => new Promise(resolve => setTimeout(resolve, 50));

const until = async (holds: () => boolean) => {
  for (let i = 0; i < 400 && !holds(); i++) await new Promise(resolve => setTimeout(resolve, 5));
  expect(holds()).toBe(true);
};

describe("useTrackMenuAutoClose", () => {
  const menu = useTrackMenu();

  beforeEach(async () => {
    queueState.queue = [];
    menu.closeMenu();
    menu.closeDropdown();
    await db.open();
    await Promise.all(db.tables.map(table => table.clear()));
  });

  describe("контекст queue", () => {
    it("закрывает меню, когда элемент исчез из очереди", async () => {
      const itemId = QueueItemId("q-1");
      queueState.queue = [{ id: itemId }, { id: QueueItemId("q-2") }];

      menu.openMenu(makeTrack(), 0, { queueItemId: itemId, target: "queue" });
      const isOpen = shallowRef(true);
      const wrapper = mountAutoClose(isOpen, "queue");

      queueState.queue = [{ id: QueueItemId("q-2") }];
      await nextTick();

      expect(menu.isContextMenuOpen.value).toBe(false);
      wrapper.unmount();
    });

    it("не закрывает, пока элемент на месте", async () => {
      const itemId = QueueItemId("q-1");
      queueState.queue = [{ id: itemId }];

      menu.openMenu(makeTrack(), 0, { queueItemId: itemId, target: "queue" });
      const isOpen = shallowRef(true);
      const wrapper = mountAutoClose(isOpen, "queue");

      queueState.queue = [{ id: itemId }, { id: QueueItemId("q-2") }];
      await nextTick();

      expect(menu.isContextMenuOpen.value).toBe(true);
      wrapper.unmount();
    });

    it("не закрывает меню текущего трека: его нет в предстоящих, но он в очереди", async () => {
      const itemId = QueueItemId("q-current");
      queueState.queue = [{ id: itemId }, { id: QueueItemId("q-2") }];

      // The shell is mounted closed and opened later, like the real
      // dropdown: the "gone" check runs on the open transition.
      const isOpen = shallowRef(false);
      const wrapper = mountAutoClose(isOpen, "queue");
      menu.openMenu(makeTrack(), 0, { queueItemId: itemId, target: "queue" });
      isOpen.value = true;
      await nextTick();

      expect(menu.isContextMenuOpen.value).toBe(true);
      wrapper.unmount();
    });

    it("не реагирует при закрытом меню", async () => {
      const itemId = QueueItemId("q-1");
      queueState.queue = [{ id: itemId }];

      menu.openMenu(makeTrack(), 0, { queueItemId: itemId, target: "queue" });
      const isOpen = shallowRef(false);
      const wrapper = mountAutoClose(isOpen, "queue");

      queueState.queue = [];
      await nextTick();

      expect(menu.isContextMenuOpen.value).toBe(true);
      wrapper.unmount();
    });
  });

  describe("контекст playlist", () => {
    it("useTrackMenuAutoClose: follows the row after a write", async () => {
      const track = makeTrack("t-1");
      await db.playlists.add({ id: PLAYLIST_ID, name: "P", trackIds: [track.id, TrackId("t-2")], addedAt: 1, updatedAt: 1 });

      menu.openMenu(track, 0, { target: "playlist" });
      const isOpen = shallowRef(true);
      const wrapper = mountAutoClose(isOpen, "playlist");
      await quiet();
      expect(menu.isContextMenuOpen.value).toBe(true);

      await removeTrackFromPlaylistAndSync(new QueryClient(), PLAYLIST_ID, track.id);

      await until(() => !menu.isContextMenuOpen.value);
      wrapper.unmount();
    });

    it("stays open while the playlist has no row", async () => {
      const track = makeTrack("t-1");

      menu.openMenu(track, 0, { target: "playlist" });
      const isOpen = shallowRef(true);
      const wrapper = mountAutoClose(isOpen, "playlist");
      await quiet();

      expect(menu.isContextMenuOpen.value).toBe(true);
      wrapper.unmount();
    });
  });
});
