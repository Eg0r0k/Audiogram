<template>
  <template
    v-for="(entry, index) in model.entries"
    :key="entryKey(entry, index)"
  >
    <component
      :is="Separator"
      v-if="entry.kind === 'separator'"
    />

    <AddToPlaylistSub
      v-else-if="entry.kind === 'slot' && entry.slot === 'addToPlaylist'"
      @add="actions.addToPlaylist"
    />

    <NavigationItems
      v-else-if="entry.kind === 'slot' && entry.slot === 'navigation'"
      :artist-ids="entry.artistIds"
      :album-id="entry.albumId ?? undefined"
      @go-to-artist="actions.goToArtist"
      @go-to-album="actions.goToAlbum"
    />

    <component
      :is="Sub"
      v-else-if="entry.kind === 'submenu'"
    >
      <component :is="SubTrigger">
        <component
          :is="TRACK_MENU_ICONS[entry.icon]"
          class="size-5.5"
        />
        {{ $t(entry.label) }}
      </component>

      <component
        :is="SubContent"
        class="w-56"
      >
        <component
          :is="Item"
          v-for="child in entry.children"
          :key="child.action"
          :color="child.tone"
          @click="run(child.action)"
        >
          <component
            :is="TRACK_MENU_ICONS[child.icon]"
            :class="iconClass(child.icon)"
          />
          {{ $t(child.label) }}{{ progressSuffix(child.progress) }}
        </component>
      </component>
    </component>

    <component
      :is="Item"
      v-else-if="entry.kind === 'item'"
      :color="entry.tone"
      @click="run(entry.action)"
    >
      <component
        :is="TRACK_MENU_ICONS[entry.icon]"
        :class="iconClass(entry.icon)"
      />
      {{ $t(entry.label) }}{{ progressSuffix(entry.progress) }}
    </component>
  </template>
</template>

<script setup lang="ts">
import type { TrackMenuAction, TrackMenuEntry, TrackMenuFacts, TrackMenuIcon } from "@/modules/tracks/lib/trackMenu";
import AddToPlaylistSub from "./items/AddToPlaylistSub.vue";
import NavigationItems from "./items/NavigationItems.vue";
import { useTrackMenuModel } from "./composables/useTrackMenuModel";
import { TRACK_MENU_ICONS } from "./trackMenuIcons";
import { useTrackMenuComponents } from "./useTrackMenuComponents";
import type { TrackMenuActions } from "./type";

const props = defineProps<{
  input: TrackMenuFacts;
  actions: TrackMenuActions;
}>();

const { Item, Separator, Sub, SubTrigger, SubContent } = useTrackMenuComponents();

const model = useTrackMenuModel(() => props.input);

const entryKey = (entry: TrackMenuEntry, index: number): string => {
  switch (entry.kind) {
    case "item":
      return entry.action;
    case "submenu":
      return entry.id;
    case "slot":
      return entry.slot;
    case "separator":
      return `separator-${index}`;
  }
};

const iconClass = (icon: TrackMenuIcon) => (icon === "like" || icon === "liked" ? "size-5.5 text-primary" : "size-5.5");

const progressSuffix = (progress: number | undefined) => (progress === undefined ? "" : ` \u00b7 ${progress}%`);

const run = (action: TrackMenuAction) => props.actions[action]?.();
</script>
