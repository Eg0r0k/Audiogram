<template>
  <SettingsScreen :title="$t('settings.index.audio')">
    <EqualizerSection />

    <FadeSection />

    <NormalizationSection />
  </SettingsScreen>
</template>

<script setup lang="ts">

import SettingsScreen from "@/modules/settings/components/SettingsScreen.vue";

import EqualizerSection from "./components/audio/EqualizerSection.vue";
import FadeSection from "./components/audio/FadeSection.vue";
import NormalizationSection from "./components/audio/NormalizationSection.vue";
</script>
