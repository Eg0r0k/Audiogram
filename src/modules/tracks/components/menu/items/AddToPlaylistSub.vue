<template>
  <component :is="Sub">
    <component :is="SubTrigger">
      <IconPlaylistAdd class="mr-3 size-5.5" />
      {{ $t('track.contextMenu.addToPlaylist') }}
    </component>

    <component
      :is="SubContent"
      class="w-56 "
    >
      <div class="p-0.5">
        <InputGroup class="dark:bg-background! bg-muted!   h-8">
          <InputGroupInput
            v-model="searchQuery"
            :placeholder="$t('track.contextMenu.searchPlaylist')"
            @keydown.stop
          />
          <InputGroupAddon>
            <IconSearch class="size-4" />
          </InputGroupAddon>
        </InputGroup>
      </div>

      <component :is="Separator" />

      <component
        :is="Item"
        @click="emit('create')"
      >
        <IconPlus class="size-5.5" />
        {{ $t('track.contextMenu.createPlaylist') }}
      </component>

      <template v-if="isLoading">
        <component :is="Separator" />
        <div class="flex items-center justify-center py-3">
          <IconLoader2 class="size-4 animate-spin text-muted-foreground" />
        </div>
      </template>

      <template v-else-if="filteredPlaylists.length">
        <component :is="Separator" />
        <Scrollable class=" h-24!">
          <component
            :is="Item"
            v-for="playlist in filteredPlaylists"
            :key="playlist.id"
            @click="emit('add', playlist.id)"
          >
            <IconPlaylist class="size-5.5" />
            <span class="truncate">{{ playlist.name }}</span>
          </component>
        </Scrollable>
      </template>

      <template v-else-if="searchQuery && playlists.length">
        <component :is="Separator" />
        <div class="p-3 text-center text-sm text-muted-foreground">
          {{ $t('track.contextMenu.noPlaylistsFound') }}
        </div>
      </template>

      <template v-else-if="!playlists.length">
        <component :is="Separator" />
        <div class="p-3 text-center text-sm text-muted-foreground">
          {{ $t('track.contextMenu.noPlaylistsYet') }}
        </div>
      </template>
    </component>
  </component>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import IconSearch from "~icons/tabler/search";
import IconPlaylistAdd from "~icons/tabler/playlist-add";
import IconPlus from "~icons/tabler/plus";
import IconPlaylist from "~icons/tabler/playlist";
import IconLoader2 from "~icons/tabler/loader-2";
import type { PlaylistId } from "@/types/ids";
import { useTrackMenuComponents } from "../../menu/useTrackMenuComponents";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";

interface Playlist {
  id: PlaylistId;
  name: string;
}

const props = defineProps<{
  playlists: Playlist[];
  isLoading?: boolean;
}>();

const emit = defineEmits<{
  add: [playlistId: PlaylistId];
  create: [];
}>();

const { Item, Separator, Sub, SubTrigger, SubContent } = useTrackMenuComponents();

const searchQuery = ref("");

const filteredPlaylists = computed(() => {
  if (!searchQuery.value.trim()) return props.playlists;
  const query = searchQuery.value.toLowerCase().trim();
  return props.playlists.filter(p => p.name.toLowerCase().includes(query));
});
</script>
