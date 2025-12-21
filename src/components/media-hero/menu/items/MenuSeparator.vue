<template>
  <component :is="Separator" />
</template>

<script setup lang="ts">
import { useMenuComponents } from "@/components/media-hero/useMenuComponents";

const { Separator } = useMenuComponents();
</script>
