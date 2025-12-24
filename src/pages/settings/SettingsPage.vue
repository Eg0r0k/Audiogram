<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="pb-8">
      <SettingsGroup>
        <div class="flex pl-6 gap-6 items-center">
          <h1 class="font-bold text-xl py-3">
            Settings
          </h1>
        </div>
        <SettingsLink
          to="/settings/general"
          icon="tabler:settings"
          icon-class="bg-zinc-500"
          title="General"
        />
        <SettingsLink
          to="/settings/appearance"
          icon="tabler:palette"
          icon-class="bg-purple-500"
          title="Appearance"
        />
        <SettingsLink
          to="/settings/language"
          icon="tabler:language"
          icon-class="bg-indigo-500"
          title="Language"
          subtitle="English"
        />
      </SettingsGroup>

      <SettingsGroup class=" mt-3">
        <SettingsLink
          to="/settings/audio"
          icon="tabler:headphones"
          icon-class="bg-green-500"
          title="Audio & Playback"
        />
        <SettingsLink
          to="/settings/storage"
          icon="tabler:database"
          icon-class="bg-orange-500"
          title="Storage"
        />
        <SettingsLink
          to="/settings/notifications"
          icon="tabler:bell"
          icon-class="bg-red-500"
          title="Notifications"
        />
      </SettingsGroup>

      <SettingsGroup class="mt-3">
        <SettingsLink
          to="/settings/about"
          icon="tabler:info-circle"
          icon-class="bg-blue-500"
          title="About"
        />
      </SettingsGroup>
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import { Scrollable } from "@/components/ui/scrollable";
import SettingsGroup from "@/components/settings/SettingsGroup.vue";
import SettingsLink from "@/components/settings/SettingsLink.vue";
</script>
