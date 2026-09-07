<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="@container pb-8">
      <SettingsHeader :title="title" />

      <div class="mx-auto w-full @settings-wide:max-w-settings @settings-wide:pt-3">
        <slot />
      </div>
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import { Scrollable } from "@/components/ui/scrollable";
import SettingsHeader from "./SettingsHeader.vue";

// The wide layout keys off the settings column itself, not the viewport: the
// sidebar is resizable, so the same window can be narrow or wide.
defineProps<{ title: string }>();
</script>
