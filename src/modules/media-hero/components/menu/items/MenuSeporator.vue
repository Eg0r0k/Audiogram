<template>
  <component :is="Separator" />
</template>

<script setup lang="ts">
import { useMenuComponents } from "@/modules/media-hero/composables/useMenuComponents";

const { Separator } = useMenuComponents();
</script>
