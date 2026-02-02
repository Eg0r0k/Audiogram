<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="pb-8">
      <SettingsGroup>
        <div class="flex pl-4 gap-6 items-center">
          <h1 class="font-bold text-xl py-3">
            {{ $t('settings.index.title') }}
          </h1>
        </div>
        <SettingsLink
          to="/settings/general"
          :icon="IconSettings"
          :title="$t('settings.index.general')"
        />
        <SettingsLink
          to="/settings/appearance"
          :icon="IconPalette"
          :title="$t('settings.index.appearance')"
        />
        <SettingsLink
          to="/settings/language"
          :icon="IconLanguage"
          :title="$t('settings.index.language')"
          subtitle="English"
        />
      </SettingsGroup>

      <SettingsGroup class=" mt-3">
        <SettingsLink
          to="/settings/audio"
          :icon="IconHeadphones"
          :title="$t('settings.index.audio')"
        />
        <SettingsLink
          to="/settings/storage"
          :icon="IconDatabase"
          :title="$t('settings.index.storage')"
        />
        <SettingsLink
          to="/settings/notifications"
          :icon="IconBell"
          :title="$t('settings.index.notifications')"
        />
      </SettingsGroup>

      <SettingsGroup class="mt-3">
        <SettingsLink
          to="/settings/about"
          :icon="IconInfo"
          :title="$t('settings.index.about')"
        />
      </SettingsGroup>
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import { Scrollable } from "@/components/ui/scrollable";
import IconSettings from "~icons/tabler/settings";
import IconPalette from "~icons/tabler/palette";
import IconLanguage from "~icons/tabler/language";
import IconHeadphones from "~icons/tabler/headphones";
import IconDatabase from "~icons/tabler/database";
import IconBell from "~icons/tabler/bell";
import IconInfo from "~icons/tabler/info-circle";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsLink from "@/modules/settings/components/SettingsLink.vue";
</script>
