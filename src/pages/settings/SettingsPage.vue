<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="pb-8">
      <SettingsGroup>
        <div class="flex pl-6 gap-6 items-center">
          <h1 class="font-bold text-xl py-3">
            {{ $t('settings.index.title') }}
          </h1>
        </div>
        <SettingsLink
          to="/settings/general"
          icon="tabler:settings"
          :title="$t('settings.index.general')"
        />
        <SettingsLink
          to="/settings/appearance"
          icon="tabler:palette"
          :title="$t('settings.index.appearance')"
        />
        <SettingsLink
          to="/settings/language"
          icon="tabler:language"
          :title="$t('settings.index.language')"
          subtitle="English"
        />
      </SettingsGroup>

      <SettingsGroup class=" mt-3">
        <SettingsLink
          to="/settings/audio"
          icon="tabler:headphones"
          :title="$t('settings.index.audio')"
        />
        <SettingsLink
          to="/settings/storage"
          icon="tabler:database"
          :title="$t('settings.index.storage')"
        />
        <SettingsLink
          to="/settings/notifications"
          icon="tabler:bell"
          :title="$t('settings.index.notifications')"
        />
      </SettingsGroup>

      <SettingsGroup class="mt-3">
        <SettingsLink
          to="/settings/about"
          icon="tabler:info-circle"
          :title="$t('settings.index.about')"
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
