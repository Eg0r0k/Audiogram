<template>
  <SettingsScreen :title="$t('settings.index.library')">
    <WatchedFoldersSection v-if="platformCaps.hasFs" />

    <ActiveDownloads v-if="platformCaps.hasFs" />

    <SettingsGroup :class="{ 'mt-3': platformCaps.hasFs }">
      <div class="px-4 py-3">
        <div class="text-primary font-medium">
          {{ $t('settings.library.analysis') }}
        </div>
      </div>
      <Item @click="setAnalyzeTracks(!analyzeTracks)">
        <ItemContent>
          <ItemTitle>{{ $t('settings.general.analyzeTracks') }}</ItemTitle>
        </ItemContent>
        <ItemActions>
          <Switch
            :model-value="analyzeTracks"
            @click.stop
            @update:model-value="setAnalyzeTracks"
          />
        </ItemActions>
      </Item>
    </SettingsGroup>

    <SettingsGroup class="mt-3">
      <Item
        v-ripple
        as-child
        size="sm"
        class="cursor-pointer"
      >
        <button
          type="button"
          class="w-full text-left disabled:pointer-events-none disabled:opacity-50"
          :disabled="isClearing"
          @click="clearFoldersData"
        >
          <ItemMedia>
            <IconTrash class="size-6 mr-3 text-destructive" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle class="text-destructive">
              {{ $t('settings.storage.folders') }}
            </ItemTitle>
            <ItemDescription>{{ $t('settings.storage.foldersDesc') }}</ItemDescription>
          </ItemContent>
        </button>
      </Item>
    </SettingsGroup>
  </SettingsScreen>
</template>

<script setup lang="ts">
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Switch } from "@/components/ui/switch";
import IconTrash from "~icons/tabler/trash";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsScreen from "@/modules/settings/components/SettingsScreen.vue";
import { useGeneralSettings } from "@/modules/settings/store/general";
import { useStorageSettings } from "@/modules/settings/store/storage";
import ActiveDownloads from "@/modules/downloads/components/ActiveDownloads.vue";
import WatchedFoldersSection from "@/modules/watched-folders/components/WatchedFoldersSection.vue";
import { platformCaps } from "@/lib/environment/platformCaps";

const { analyzeTracks, setAnalyzeTracks } = useGeneralSettings();
const { isClearing, clearFoldersData } = useStorageSettings();
</script>
