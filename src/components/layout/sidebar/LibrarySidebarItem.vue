<script setup lang="ts">
import { computed } from "vue";
import type { LibraryItem } from "@/modules/library/types";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import IconPinFilled from "~icons/tabler/pin-filled";
import { useLibraryMenu } from "@/modules/library/composables/useLibraryMenu";
import Link from "@/components/ui/link/Link.vue";
import type { CoverOwnerType } from "@/db/entities";
import EntityCoverImage from "@/components/ui/EntityCoverImage.vue";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";

const props = defineProps<{
  item: LibraryItem;
}>();

const { openMenu } = useLibraryMenu();

const typeLabel = computed(() => {
  const labels: Record<string, string> = {
    artist: "Artist",
    album: "Album",
    playlist: "Playlist",
    liked: "Liked",
  };

  return labels[props.item.type] ?? props.item.type;
});

const subtitle = computed(() => {
  return props.item.subtitle
    ? `${typeLabel.value} · ${props.item.subtitle}`
    : typeLabel.value;
});

const coverOwnerType = computed<CoverOwnerType | null>(() => {
  if (props.item.type === "album") return "album";
  if (props.item.type === "playlist") return "playlist";
  return null;
});

const coverOwnerId = computed(() => {
  if (props.item.type === "album" || props.item.type === "playlist") {
    return props.item.id;
  }

  return null;
});

const hasStaticImage = computed(() => !!props.item.image);
</script>

<template>
  <Link
    :to="item.to"
    class="block mx-2"
    data-library-item
    @contextmenu="openMenu(item)"
  >
    <Item class="gap-3 px-3 py-2 min-w-0">
      <ItemMedia
        class="size-[54px] z-1 overflow-hidden"
        :class="item.rounded ? 'rounded-full' : 'rounded-md'"
      >
        <NuxtImage
          v-if="hasStaticImage"
          :src="item.image"
          :alt="item.title"
          class="size-full object-cover"
        />

        <EntityCoverImage
          v-else
          :owner-type="coverOwnerType"
          :owner-id="coverOwnerId"
          :alt="item.title"
          class="size-full object-cover"
          :image-class="item.rounded
            ? 'size-full object-cover rounded-full'
            : 'size-full object-cover rounded-md'"
        />
      </ItemMedia>

      <ItemContent class="min-w-0 overflow-hidden">
        <ItemTitle class="block min-w-0 w-full! overflow-hidden text-ellipsis whitespace-nowrap">
          {{ item.title }}
        </ItemTitle>

        <ItemDescription class="block min-w-0">
          <span class="flex items-center min-w-0 gap-1">
            <span class="min-w-0 flex-1 truncate">
              {{ subtitle }}
            </span>

            <IconPinFilled
              v-if="item.isPinned"
              class="size-5 shrink-0 text-primary"
            />
          </span>
        </ItemDescription>
      </ItemContent>
    </Item>
  </Link>
</template>
