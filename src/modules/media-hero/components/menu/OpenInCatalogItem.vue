<template>
  <component
    :is="Item"
    v-if="route"
    @click="router.push(route)"
  >
    <IconArrowUpRight class="size-5.5" />
    {{ $t('media.openInCatalog') }}
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import IconArrowUpRight from "~icons/tabler/arrow-up-right";
import { useMediaContext } from "@/modules/media-hero/composables/useMediaContext";
import { useMenuComponents } from "@/modules/media-hero/composables/useMenuComponents";

const router = useRouter();
const actions = useMediaContext();
const route = computed(() => actions.catalogRoute?.value ?? null);

const { Item } = useMenuComponents();
</script>
