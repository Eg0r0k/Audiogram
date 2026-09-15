<template>
  <template v-if="artistIds.length === 1">
    <component
      :is="Item"
      @click="emit('goToArtist', artistIds[0])"
    >
      <IconUser
        class="size-5.5"
      />
      {{ $t('track.contextMenu.goToArtist') }}
    </component>
  </template>

  <template v-else-if="artistIds.length > 1">
    <component
      :is="Sub"
      @update:open="onSubOpenChange"
    >
      <component :is="SubTrigger">
        <IconUsers
          class="size-5.5"
        />
        {{ $t('track.contextMenu.goToArtists') }}
      </component>

      <component
        :is="SubContent"
        class="w-48"
      >
        <template v-if="isLoading">
          <div class="flex items-center justify-center py-3">
            <Spinner class="size-4 text-muted-foreground" />
          </div>
        </template>
        <template v-else>
          <component
            :is="Item"
            v-for="artist in artists"
            :key="artist.id"
            @click="emit('goToArtist', artist.id)"
          >
            {{ artist.name }}
          </component>
        </template>
      </component>
    </component>
  </template>

  <component
    :is="Item"
    v-if="albumId"
    @click="emit('goToAlbum')"
  >
    <IconDisc
      class="size-5.5"
    />
    {{ $t('track.contextMenu.goToAlbum') }}
  </component>
</template>

<script setup lang="ts">
import { shallowRef, watch } from "vue";
import { useTrackMenuComponents } from "../useTrackMenuComponents";
import { Spinner } from "@/components/ui/spinner";
import IconDisc from "~icons/tabler/disc";
import IconUser from "~icons/tabler/user";
import IconUsers from "~icons/tabler/users";
import type { AlbumId, ArtistId } from "@/types/ids";
import type { ArtistEntity } from "@/db/entities";
import { getArtistsByIds } from "@/queries/artist.queries";

defineOptions({
  inheritAttrs: false,
});

// Ephemeral tracks (YouTube stream, radio) have no library identifiers —
// default to "no artists" instead of crashing the menu render. A library
// track imported without an album tag carries an empty albumId (see
// track-persister), which hides "Go to album" the same way.
const props = withDefaults(defineProps<{
  artistIds?: ArtistId[];
  albumId?: AlbumId;
}>(), {
  artistIds: () => [],
  albumId: undefined,
});

const { Item, Sub, SubTrigger, SubContent } = useTrackMenuComponents();

const artists = shallowRef<ArtistEntity[]>([]);
const isLoading = shallowRef(false);
let hasLoaded = false;

async function onSubOpenChange(open: boolean) {
  if (!open || hasLoaded) return;
  hasLoaded = true;
  isLoading.value = true;

  const requestedIds = props.artistIds;
  const result = await getArtistsByIds(requestedIds);
  if (requestedIds !== props.artistIds) return;

  artists.value = result;
  isLoading.value = false;
}

watch(() => props.artistIds, () => {
  hasLoaded = false;
  isLoading.value = false;
  artists.value = [];
});

const emit = defineEmits<{
  goToArtist: [artistId: ArtistId];
  goToAlbum: [];
}>();
</script>
