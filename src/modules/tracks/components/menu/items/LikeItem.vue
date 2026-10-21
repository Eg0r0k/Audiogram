<template>
  <component
    :is="Item"
    v-if="!inSheet"
    @click="emit('toggle')"
  >
    <IconLikedFilled
      v-if="isLiked"
      class="size-5.5 text-primary"
    />
    <IconLike
      v-else
      class="size-5.5 text-primary"
    />
    {{
      !isLiked
        ? $t("track.contextMenu.addToFavorites")
        : $t("track.contextMenu.removeFromFavorites")
    }}
  </component>
</template>
<script setup lang="ts">
import { computed } from "vue";
import { injectResponsiveMenu } from "@/components/ui/responsive-menu";
import IconLike from "~icons/tabler/heart";
import IconLikedFilled from "~icons/tabler/heart-filled";
import { useTrackMenuComponents } from "../useTrackMenuComponents";

defineProps<{
  isLiked: boolean;
}>();

const { Item } = useTrackMenuComponents();
const responsiveMenu = injectResponsiveMenu();
// The sheet header shows this as a button.
const inSheet = computed(() => responsiveMenu?.mode.value === "sheet");

const emit = defineEmits<{
  toggle: [];
}>();
</script>
