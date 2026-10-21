<template>
  <SettingsScreen :title="$t('settings.index.title')">
    <SettingsGroup>
      <SettingsLink
        :to="routeLocation.settingsGeneral()"
        :icon="IconSettings"
        :title="$t('settings.index.general')"
      />
      <SettingsLink
        :to="routeLocation.settingsAppearance()"
        :icon="IconPalette"
        :title="$t('settings.index.appearance')"
        :subtitle="themeLabel"
      />
      <SettingsLink
        :to="routeLocation.settingsAudio()"
        :icon="IconHeadphones"
        :title="$t('settings.index.audio')"
      />
    </SettingsGroup>

    <SettingsGroup class="mt-3">
      <SettingsLink
        :to="routeLocation.settingsLibrary()"
        :icon="IconBooks"
        :title="$t('settings.index.library')"
        :description="$t('settings.index.libraryDescription')"
      />
      <SettingsLink
        v-if="platformCaps.canProxyStream"
        :to="routeLocation.settingsSources()"
        :icon="IconServer"
        :title="$t('settings.index.sources')"
      >
        <template #description>
          <span class="inline-flex flex-wrap items-center gap-x-1.5">
            <template v-if="needsAttention">
              <span
                class="size-2 shrink-0 rounded-full bg-destructive"
                aria-hidden="true"
              />
              <span>{{ $t('settings.index.needsAttention') }}</span>
              <span aria-hidden="true">·</span>
            </template>
            <span>{{ $t('settings.index.sourcesCount', sourceCount) }}</span>
          </span>
        </template>
      </SettingsLink>
      <SettingsLink
        :to="routeLocation.settingsStorage()"
        :icon="IconDatabase"
        :title="$t('settings.index.storage')"
        :description="storageDescription"
      />
    </SettingsGroup>

    <SettingsGroup class="mt-3">
      <SettingsLink
        :to="routeLocation.settingsAbout()"
        :icon="IconInfo"
        :title="$t('settings.index.about')"
        :subtitle="appVersion"
      />
      <SettingsLink
        v-if="isDev"
        :to="routeLocation.devRecoStand()"
        :icon="IconFlask"
        title="Dev: стенд рекомендаций"
      />
    </SettingsGroup>
  </SettingsScreen>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import IconSettings from "~icons/tabler/settings";
import IconPalette from "~icons/tabler/palette";
import IconHeadphones from "~icons/tabler/headphones";
import IconBooks from "~icons/tabler/books";
import IconDatabase from "~icons/tabler/database";
import IconServer from "~icons/tabler/server";
import IconInfo from "~icons/tabler/info-circle";
import IconFlask from "~icons/tabler/flask";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsLink from "@/modules/settings/components/SettingsLink.vue";
import SettingsScreen from "@/modules/settings/components/SettingsScreen.vue";
import { useTheme } from "@/modules/settings/composables/useTheme";
import { useStorageSettings } from "@/modules/settings/store/storage";
import { sources } from "@/modules/sources";
import { sourceHealth } from "@/modules/sources/lib/health";
import { routeLocation } from "@/app/router/route-locations";
import { platformCaps } from "@/lib/environment/platformCaps";
import { getLogger } from "@/lib/logger";
import { formatError } from "@/lib/errors";

const { t } = useI18n();
const { mode } = useTheme();
const isDev = import.meta.env.DEV;
const appVersion = __APP_VERSION__;

const themeLabel = computed(() => t(`settings.appearance.themes.${mode.value}`));

const sourceCount = computed(() => sources.all().length);
// Only a verdict counts: a source nobody has asked yet is not a problem.
const needsAttention = computed(() => sources.all().some(provider => sourceHealth(provider.id).state === "failed"));

const { info, formatted, refresh } = useStorageSettings();
const storageDescription = computed(() =>
  info.value ? t("settings.index.storageUsed", { size: formatted.value.totalUsed }) : undefined,
);

onMounted(() => {
  refresh().catch((err: unknown) => {
    getLogger().warn(`[SettingsPage] Refreshing storage usage failed: ${formatError(err)}`);
  });
});
</script>
