<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <slot>
        <Button
          class="rounded-full"
          size="icon-lg"
          variant="ghost"
        >
          <Icon
            class="size-5"
            icon="tabler:dots"
          />
        </Button>
      </slot>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      class="w-60"
      align="start"
    >
      <component
        :is="contextComponent"
        v-bind="contextProps"
      />
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu";
import Button from "@/components/ui/button/Button.vue";
import { computed, type Component } from "vue";
import { useMediaContext } from "@/composables/useMediaContext";
import { Icon } from "@iconify/vue";
import { provideMenuComponents, dropdownMenuComponents } from "@/components/media-hero/useMenuComponents";
import { MediaContext } from "../types";
import AlbumContext from "../contexts/AlbumContext.vue";
import ArtistContext from "../contexts/ArtistContext.vue";

provideMenuComponents(dropdownMenuComponents);

interface Props {
  context?: MediaContext;
  isPlaylistOwner?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  context: "album",
});

const contexts: Record<MediaContext, Component> = {
  "album": AlbumContext,
  "artist-page": ArtistContext,
  "liked": AlbumContext,
  "playlist": AlbumContext,
};

const actions = useMediaContext();

const contextComponent = computed(() => contexts[props.context]);

const contextProps = computed(() => {
  const base = { actions };
  switch (props.context) {
    case "playlist":
      return { ...base, isOwner: props.isPlaylistOwner };
    default:
      return base;
  }
});
</script>
