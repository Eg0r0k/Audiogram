<template>
  <component :is="LayoutComponent">
    <RouterView v-slot="{ Component, route }">
      <SlideTransition :depth="route.meta.depth">
        <component
          :is="Component"
          :key="route.fullPath"
          class="page-wrapper bg-muted dark:bg-background"
        />
      </SlideTransition>
    </RouterView>
  </component>
  <WhatsNewDialog />
  <ExternalLinkDialog />
  <Toaster
    position="top-center"
    class="pointer-events-auto"
  />
</template>

<script setup lang="ts">
import "vue-sonner/style.css";
import { Toaster } from "@/components/ui/sonner";
import { type Component as VueComponent, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import BlankLayout from "@/layouts/BlankLayout.vue";
import MobileLayout from "@/layouts/MobileLayout.vue";
import { listenForOpenedFiles, OpenedFile } from "@/lib/files/fileOpener";
import { useTheme } from "@/modules/settings/composables/useTheme";
import { useSetupRootClasses } from "@/composables/useSetupRootClasses";
import { usePreventPinchZoom } from "@/composables/usePreventPinchZoom";
import { useGeneralSettings } from "@/modules/settings/store/general";
import SlideTransition from "@/components/transitions/SlideTransition.vue";
import ExternalLinkDialog from "@/components/dialogs/ExternalLinkDialog.vue";
import { useAccentColor } from "@/modules/settings/composables/useAccentColor";
import { useAudioSettings } from "@/modules/settings/composables/useAudioSettings";
import { useDeviceLayout } from "@/composables/useDeviceLayout";
import { useWatchedFolders } from "@/modules/watched-folders/composables/useWatchedFolders";
import { useGlobalHotKeys } from "@/modules/hotkeys";
import { useMediaSession } from "@/modules/player/composables/useMediaSession";
import { useImport } from "@/composables/useImport";
import { IS_TAURI } from "@/lib/environment/userAgent";
import { useUpdateStore } from "@/modules/update/store/update.store";
import { useUpdateScheduler } from "@/modules/update/composables/useUpdateScheduler";
import { usePwaUpdate } from "@/modules/update/composables/usePwaUpdate";
import { useChangelogOnStartup } from "@/modules/update/composables/useChangelogOnStartup";
import WhatsNewDialog from "@/modules/update/components/WhatsNewDialog.vue";

const currentRoute = useRoute();
const { isMobileLayout } = useDeviceLayout();
const { init } = useWatchedFolders();
const { importFromPaths } = useImport();

const layouts: Record<string, VueComponent> = {
  default: DefaultLayout,
  blank: BlankLayout,
  mobile: MobileLayout,
};

const LayoutComponent = computed(() => {
  if (currentRoute.meta.layout === "blank") return BlankLayout;

  if (isMobileLayout) return MobileLayout;

  const layoutName = currentRoute.meta.layout ?? "default";
  return layouts[layoutName] ?? DefaultLayout;
});

let unlisten: (() => void) | null = null;
const { init: initGeneral } = useGeneralSettings();

onMounted(async () => {
  initGeneral();

  if (IS_TAURI) {
    const [{ useTauriGlobalShortcuts }] = await Promise.all([
      import("@/modules/hotkeys/composables/useTauriGlobalShortcuts"),
    ]);

    useTauriGlobalShortcuts();
  }

  unlisten = await listenForOpenedFiles(async (files: OpenedFile[]) => {
    await importFromPaths(files.map(f => f.path));
  });

  init();
});
onUnmounted(() => {
  unlisten?.();
});

useTheme();
useAccentColor();
useSetupRootClasses();
usePreventPinchZoom();
useAudioSettings();
useGlobalHotKeys();
useMediaSession();

// UPDATE

const updateStore = useUpdateStore();

if (IS_TAURI) {
  useUpdateScheduler();
}
else {
  usePwaUpdate(updateStore.channel);
}

useChangelogOnStartup();

</script>

<style scoped>
.app-grid {
  display: grid;
  grid-template-areas:
    "toolbar"
    "header"
    "content"
    "footer";
  grid-template-rows: auto auto 1fr auto;
}

.toolbar {
  grid-area: toolbar;
}

.header {
  grid-area: header;
}

.content-area {
  grid-area: content;
  display: flex;
  overflow: hidden;
}

.main {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-width: 0;
}

.footer {
  grid-area: footer;
}
</style>
