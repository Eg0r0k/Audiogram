<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="pb-8">
      <SettingsHeader :title="$t('settings.index.storage')" />

      <div
        v-if="isLoading && !info"
        class="flex items-center justify-center py-16"
      >
        <IconLoader2 class="size-6 animate-spin text-muted-foreground" />
      </div>

      <template v-else>
        <SettingsGroup>
          <div class="px-4 py-4">
            <div class="mb-1 text-sm font-medium">
              {{ $t('settings.storage.usage') }}
            </div>
            <p class="mb-3 text-xs text-muted-foreground">
              {{ formatted.totalUsed }} {{ $t('settings.storage.used') }}
              <template v-if="formatted.quotaTotal">
                · {{ formatted.quotaFree }} {{ $t('settings.storage.free') }}
              </template>
            </p>
          </div>
        </SettingsGroup>

        <SettingsGroup class="mt-3 mb-3">
          <div class="px-4 py-3">
            <div class="text-primary font-medium mb-1">
              Storage Size
            </div>
          </div>
          <Item>
            <ItemMedia>
              <MusicIcon class="size-6" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{{ $t('settings.storage.database') }}</ItemTitle>
              <ItemSubtitle>
                {{ formatted.tracksCount }} {{ $t('settings.storage.tracksCount') }}
                · {{ formatted.albumsCount }} {{ $t('settings.storage.albumsCount') }}
                · {{ formatted.artistsCount }} {{ $t('settings.storage.artistsCount') }} ({{ formatted.dbSize }})
              </ItemSubtitle>
            </ItemContent>
          </Item>
          <Item>
            <ItemMedia>
              <MusicIcon class="size-6" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{{ $t('settings.storage.tracks') }}</ItemTitle>
              <ItemSubtitle>
                <span class="text-sm text-muted-foreground">{{ formatted.tracksSize }}</span>
              </ItemSubtitle>
            </ItemContent>
            <ItemActions />
          </Item>

          <Item>
            <ItemMedia>
              <ImageIcon class="size-6" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{{ $t('settings.storage.covers') }}</ItemTitle>
              <ItemSubtitle>
                <span class="text-sm text-muted-foreground">{{ formatted.coversSize }}</span>
              </ItemSubtitle>
            </ItemContent>
          </Item>
          <Item>
            <ItemContent>
              <ItemTitle>{{ $t('settings.storage.location') }}</ItemTitle>
              <ItemSubtitle class="break-all">
                {{ formatted.storagePath }}
              </ItemSubtitle>
            </ItemContent>
          </Item>
          <Button
            class="w-full h-14 justify-start  "
            variant="ghost-primary"
            size="xl"
            @click="clearAllData"
          >
            <TrashIcon class=" size-6" />
            {{ $t('settings.storage.clearAll') }}
          </Button>
        </SettingsGroup>
      </template>
      <WatchedFoldersSection
        v-if="IS_TAURI"
      />
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemMedia,
  ItemSubtitle,
  ItemTitle,
} from "@/components/ui/item";

import { Scrollable } from "@/components/ui/scrollable";

import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsHeader from "@/modules/settings/components/SettingsHeader.vue";

import { useStorageSettings } from "@/modules/settings/store/storage";
import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";

import TrashIcon from "~icons/tabler/trash";
import ImageIcon from "~icons/tabler/photo";
import MusicIcon from "~icons/tabler/music";

import IconLoader2 from "~icons/tabler/loader-2";
import { Button } from "@/components/ui/button";
import { IS_TAURI } from "@/lib/environment/userAgent";
import WatchedFoldersSection from "@/modules/watched-folders/components/WatchedFoldersSection.vue";

const { t } = useI18n();

const {
  info,
  isLoading,
  formatted,
  refresh,
  clearCovers,
  clearAllData,
} = useStorageSettings();

const showDeleteDialog = ref(false);

onMounted(() => {
  refresh();
});

const handleClearCovers = async () => {
  await clearCovers();
  toast.success(t("settings.storage.coversCleared"));
};

const handleDeleteAll = async () => {
  await clearAllData();
  showDeleteDialog.value = false;
  toast.success(t("settings.storage.allDataCleared"));
};
</script>
