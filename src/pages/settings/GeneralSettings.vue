<script setup lang="ts">
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsHeader from "@/modules/settings/components/SettingsHeader.vue";

</script>

<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="pb-8">
      <SettingsHeader :title="$t('settings.index.general')" />
      <SettingsGroup>
        <div class="px-4 py-3">
          <div class="text-primary font-medium mb-1">
            General settings
          </div>
        </div>
      </SettingsGroup>
    </div>
  </Scrollable>
</template>
