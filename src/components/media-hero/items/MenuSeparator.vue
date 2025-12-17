<template>
  <component :is="Separator" />
</template>

<script setup lang="ts">
import { useMenuComponents } from "../useMenuComponents";

const { Separator } = useMenuComponents();
</script>
