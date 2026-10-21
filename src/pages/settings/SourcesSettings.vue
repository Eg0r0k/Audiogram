<template>
  <SettingsScreen :title="$t('settings.index.sources')">
    <SettingsGroup>
      <div class="px-4 py-3">
        <div class="text-primary font-medium">
          {{ $t('settings.sourcesPage.sources') }}
        </div>
      </div>
      <SettingsLink
        v-for="source in sourceList"
        :key="source.kind"
        :to="routeLocation.settingsSource(source.kind)"
        :icon="source.ui.icon"
        :title="$t(source.ui.labelKey)"
      >
        <template #description>
          <SourceStatusLabel :kind="source.kind" />
        </template>
      </SettingsLink>
    </SettingsGroup>

    <SettingsGroup
      v-if="platformCaps.hasNativeProxy"
      class="mt-3"
    >
      <SettingsLink
        :to="routeLocation.settingsProxy()"
        :icon="IconWorld"
        :title="$t('settings.index.proxy')"
        :description="proxyEnabled ? $t('settings.proxy.on') : $t('settings.proxy.off')"
      />
    </SettingsGroup>
  </SettingsScreen>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import IconWorld from "~icons/tabler/world";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsLink from "@/modules/settings/components/SettingsLink.vue";
import SettingsScreen from "@/modules/settings/components/SettingsScreen.vue";
import { useProxySettings } from "@/modules/settings/store/proxy";
import { sources } from "@/modules/sources";
import SourceStatusLabel from "@/modules/sources/components/SourceStatusLabel.vue";
import { checkSource } from "@/modules/sources/composables/useSourceHealth";
import { sourceHealth } from "@/modules/sources/lib/health";
import { sourceUI } from "@/modules/sources/lib/source-ui";
import { routeLocation } from "@/app/router/route-locations";
import { platformCaps } from "@/lib/environment/platformCaps";
import { getLogger } from "@/lib/logger";

//
// One row per source the build registers; the page asks the registry what
// exists instead of knowing. Each row opens that source's own settings.
//

const sourceList = computed(() =>
  sources.all().map(provider => ({
    kind: provider.id,
    ui: sourceUI(provider.id),
  })),
);

const { enabled: proxyEnabled } = useProxySettings();

// A status page that says "configured" for a source nobody has probed yet
// tells the user nothing; ask the ones that can be asked.
onMounted(() => {
  for (const provider of sources.available()) {
    if (!provider.checkConnection || sourceHealth(provider.id).state !== "unknown") continue;
    checkSource(provider.id).catch((err: unknown) => {
      getLogger().warn(`[SourcesSettings] Checking ${provider.id} failed: ${String(err)}`);
    });
  }
});
</script>
