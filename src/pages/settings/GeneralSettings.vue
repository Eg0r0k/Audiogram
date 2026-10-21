<template>
  <SettingsScreen :title="$t('settings.index.general')">
    <SettingsGroup>
      <Item @click="setCheckUpdatesOnLaunch(!checkUpdatesOnLaunch)">
        <ItemContent>
          <ItemTitle>{{ $t('settings.general.checkUpdates') }}</ItemTitle>
        </ItemContent>
        <ItemActions>
          <Switch
            :model-value="checkUpdatesOnLaunch"
            @click.stop
            @update:model-value="setCheckUpdatesOnLaunch"
          />
        </ItemActions>
      </Item>
    </SettingsGroup>

    <template v-if="platformCaps.hasNativeWindow">
      <SettingsGroup class="mt-2">
        <Item @click="setLaunchAtStartup(!launchAtStartup)">
          <ItemContent>
            <ItemTitle>{{ $t('settings.general.launchAtStartup') }}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Switch
              :model-value="launchAtStartup"
              :disabled="isTogglingAutostart"
              @click.stop
              @update:model-value="handleLaunchAtStartup"
            />
          </ItemActions>
        </Item>

        <Item
          :class="{ 'opacity-40 pointer-events-none': !launchAtStartup }"
          @click="setLaunchMinimized(!launchMinimized)"
        >
          <ItemContent>
            <ItemTitle>{{ $t('settings.general.launchMinimized') }}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Switch
              :model-value="launchMinimized"
              @click.stop
              @update:model-value="setLaunchMinimized"
            />
          </ItemActions>
        </Item>

        <Item @click="setCloseToTray(!closeToTray)">
          <ItemContent>
            <ItemTitle>{{ $t('settings.general.closeToTray') }}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <Switch
              :model-value="closeToTray"
              @click.stop
              @update:model-value="setCloseToTray"
            />
          </ItemActions>
        </Item>
      </SettingsGroup>
    </template>

    <SettingsGroup class="mt-3">
      <SettingsLink
        :to="routeLocation.settingsLanguage()"
        :icon="IconLanguage"
        :title="$t('settings.index.language')"
        :subtitle="languageLabel"
      />
    </SettingsGroup>

    <SettingsGroup class="mt-3">
      <div class="px-4 py-3">
        <div class="mb-1 text-primary font-medium">
          {{ $t("settings.index.resetAll") }}
        </div>
        <div class="text-sm text-muted-foreground">
          {{ $t("settings.index.resetAllDescription") }}
        </div>
      </div>

      <Button
        class="w-full h-14 justify-start"
        size="xl"
        variant="ghost"
        @click="handleResetAllSettings"
      >
        <IconRefresh class="size-6" />
        {{ $t("settings.index.resetAllAction") }}
      </Button>
    </SettingsGroup>
  </SettingsScreen>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toaster } from "@/app/toaster";
import { summonDialog } from "@/components/dialogs/summonDialog";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item";
import IconLanguage from "~icons/tabler/language";
import IconRefresh from "~icons/tabler/refresh";
import SettingsLink from "@/modules/settings/components/SettingsLink.vue";
import { routeLocation } from "@/app/router/route-locations";
import { Switch } from "@/components/ui/switch";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsScreen from "@/modules/settings/components/SettingsScreen.vue";
import { LANGUAGE_OPTIONS, useGeneralSettings } from "@/modules/settings/store/general";
import { useSettingsStore } from "@/modules/settings/store";
import { useAudioSettingsStore } from "@/modules/settings/store/audio";
import { useTheme } from "@/modules/settings/composables/useTheme";
import { useAccentColor } from "@/modules/settings/composables/useAccentColor";
import { useZoom } from "@/modules/settings/composables/useZoom";
import { platformCaps } from "@/lib/environment/platformCaps";

const {
  checkUpdatesOnLaunch,
  closeToTray,
  launchAtStartup,
  launchMinimized,
  setCheckUpdatesOnLaunch,
  setCloseToTray,
  setLaunchAtStartup,
  setLaunchMinimized,
  language,
} = useGeneralSettings();

const languageLabel = computed(() => LANGUAGE_OPTIONS.find(option => option.code === language.value)?.native ?? language.value);

const { t } = useI18n();
const settingsStore = useSettingsStore();
const audioSettingsStore = useAudioSettingsStore();
const { changeTheme } = useTheme();
const { resetAccentColor } = useAccentColor();
const { resetZoom } = useZoom();

const handleResetAllSettings = async () => {
  const confirmed = await summonDialog("resetSettings", {}, { key: "reset-settings" });
  if (!confirmed) return;

  settingsStore.reset();
  audioSettingsStore.reset();
  changeTheme("system");
  resetAccentColor();
  resetZoom();
  toaster.add({ title: t("settings.index.resetAllDone"), color: "success" });
};

const isTogglingAutostart = ref(false);

const handleLaunchAtStartup = async (value: boolean) => {
  isTogglingAutostart.value = true;
  await setLaunchAtStartup(value);
  isTogglingAutostart.value = false;
};
</script>
