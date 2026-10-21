<template>
  <SettingsGroup>
    <div class="px-4 py-3">
      <div class="text-primary font-medium">
        {{ $t('watchedFolders.title') }}
      </div>
    </div>

    <Item @click="autoScanOnStartup = !autoScanOnStartup">
      <ItemContent>
        <ItemTitle>{{ $t('watchedFolders.autoScan') }}</ItemTitle>
        <ItemDescription>{{ $t('watchedFolders.autoScanDesc') }}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Switch
          :model-value="autoScanOnStartup"
          @click.stop
          @update:model-value="autoScanOnStartup = $event"
        />
      </ItemActions>
    </Item>

    <WatchedFolderItem
      v-for="folder in folders"
      :key="folder.id"
      :folder="folder"
      @scan="handleScan"
      @remove="confirmRemove"
      @relink="relinkFolder"
    />

    <Item
      v-if="canAddFolder"
      v-ripple
      as-child
      size="sm"
      class="cursor-pointer"
    >
      <button
        type="button"
        class="w-full text-left"
        @click="handleAddFolder"
      >
        <ItemMedia>
          <IconFolderPlus class="size-6 mr-3 text-primary" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle class="text-primary">
            {{ $t(addFolderLabelKey) }}
          </ItemTitle>
          <InlineError v-if="addFolderError">
            {{ addFolderError }}
          </InlineError>
        </ItemContent>
      </button>
    </Item>

    <Button
      v-if="folders.length > 0"
      class="w-full h-14 justify-start"
      variant="ghost"
      size="xl"
      :disabled="isAnyScanning"
      @click="scanAllFolders"
    >
      <IconRefresh class="size-6" />
      {{ $t('watchedFolders.scanAll') }}
    </Button>
  </SettingsGroup>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { reportError } from "@/app/error-feedback";
import { useI18n } from "vue-i18n";
import { formatError } from "@/lib/errors";
import { getLogger } from "@/lib/logger";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { summonDialog } from "@/components/dialogs/summonDialog";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import InlineError from "@/components/common/InlineError.vue";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import WatchedFolderItem from "./WatchedFolderItem.vue";
import { useWatchedFolders } from "../composables/useWatchedFolders";
import { isAndroidFolderPickerAvailable } from "@/lib/android/folderPicker";
import { IS_MOBILE } from "@/lib/environment/userAgent";
import type { WatchedFolder } from "../types";

import IconFolderPlus from "~icons/tabler/folder-plus";
import IconRefresh from "~icons/tabler/refresh";

const {
  folders,
  autoScanOnStartup,
  addFolder,
  removeFolder,
  scanFolder,
  scanAllFolders,
  relinkFolder,
} = useWatchedFolders();

const { t } = useI18n();

const isAnyScanning = computed(() =>
  folders.value.some(f => f.status === "scanning"),
);

// With the SAF picker bridge any internal-storage folder is bindable, any
// number of times. Without it (outdated APK, web preview) the legacy
// behavior remains: one bound Music folder, then the button disappears.
const hasMobilePicker = isAndroidFolderPickerAvailable();
const canAddFolder = computed(
  () => !IS_MOBILE || hasMobilePicker || folders.value.length === 0,
);
const addFolderLabelKey = computed(() =>
  IS_MOBILE && !hasMobilePicker ? "watchedFolders.addMusicFolder" : "watchedFolders.addFolder",
);

const addFolderError = ref<string | null>(null);

const handleAddFolder = async () => {
  addFolderError.value = null;
  addFolderError.value = await addFolder();
};

function handleScan(folder: WatchedFolder) {
  scanFolder(folder).catch(error => getLogger().error(`[WatchedFolders] Scanning ${folder.name} failed: ${formatError(error)}`));
}

async function confirmRemove(id: string) {
  const folder = folders.value.find(f => f.id === id);
  if (!folder) return;

  const confirmed = await summonDialog("removeWatchedFolder", { name: folder.name }, { key: `remove-folder:${id}` });
  if (!confirmed) return;

  try {
    await removeFolder(folder.id);
  }
  catch (e) {
    // Unawaited, this rejected into nothing: the dialog closed, the folder
    // stayed and neither the user nor the log heard about it.
    reportError(e, { title: t("watchedFolders.removeFailed", { name: folder.name }), scope: "WatchedFolders" });
  }
}
</script>
