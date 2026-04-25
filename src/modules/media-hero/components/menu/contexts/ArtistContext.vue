<template>
  <component
    :is="Item"
    @click="actions.edit"
  >
    <IconPencil class="size-5.5" />
    {{ $t("common.edit") }}
  </component>

  <component
    :is="Item"
    variant="destructive"
    @click="actions.delete"
  >
    <IconTrash class="size-5.5" />
    {{ $t("common.delete") }}
  </component>
</template>

<script setup lang="ts">
import IconPencil from "~icons/tabler/pencil";
import IconTrash from "~icons/tabler/trash";
import { useMenuComponents } from "@/modules/media-hero/composables/useMenuComponents";
import type { MediaActions } from "../types";

defineProps<{
  actions: MediaActions;
}>();

const { Item } = useMenuComponents();
</script>
