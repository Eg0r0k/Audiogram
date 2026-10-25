<template>
  <ConfigProvider :scroll-body="false">
    <TooltipProvider
      :delay-duration="150"
      :skip-delay-duration="300"
      disable-hoverable-content
    >
      <component :is="LayoutComponent">
        <RouterView v-slot="{ Component, route }">
          <SlideTransition
            :depth="route.meta.depth"
            history-aware
          >
            <component
              :is="Component"
              :key="route.fullPath"
              class="page-wrapper bg-canvas"
            />
          </SlideTransition>
        </RouterView>
      </component>
    </TooltipProvider>
    <WhatsNewDialog />
    <DialogHost />
    <NetworkStatusToast />
    <Toaster
      :max="2"
      expand
      :position="isMobileLayout ? 'bottom-center' : 'top-center'"
      :class="isMobileLayout ? 'bottom-[calc(var(--mobile-dock-height)+12px)]' : 'top-[calc(var(--toolbar-height)+12px)]'"
    />
  </ConfigProvider>
</template>

<script setup lang="ts">
import { ConfigProvider } from "reka-ui";
import { DialogHost } from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { type Component as VueComponent, computed, onMounted, onUnmounted, watch, watchEffect } from "vue";
import { useRoute } from "vue-router";
import DefaultLayout from "@/layouts/DefaultLayout.vue";
import BlankLayout from "@/layouts/BlankLayout.vue";
import MobileLayout from "@/layouts/MobileLayout.vue";
import { mobileDockHeight } from "@/layouts/mobileDock";
import { useOpenedFiles } from "@/composables/tauri/useOpenedFiles";
import { useTheme } from "@/modules/settings/composables/useTheme";
import { useSetupRootClasses } from "@/composables/useSetupRootClasses";
import { usePreventPinchZoom } from "@/composables/usePreventPinchZoom";
import { useGeneralSettings } from "@/modules/settings/store/general";
import SlideTransition from "@/components/transitions/SlideTransition.vue";
import { useAccentColor } from "@/modules/settings/composables/useAccentColor";
import { useAudioSettings } from "@/modules/settings/composables/useAudioSettings";
import { useDeviceLayout } from "@/composables/useDeviceLayout";
import { useWatchedFolders } from "@/modules/watched-folders/composables/useWatchedFolders";
import { useGlobalHotKeys } from "@/modules/hotkeys";
import { useMediaSession } from "@/modules/player/composables/useMediaSession";
import { useDiscordPresence } from "@/modules/player/composables/useDiscordPresence";
import { useTaskbarThumbbar } from "@/modules/player/composables/useTaskbarThumbbar";
import { platformCaps } from "@/lib/environment/platformCaps";
import { useAppUpdates } from "@/modules/update/composables/useAppUpdates";
import { useChangelogOnStartup } from "@/modules/update/composables/useChangelogOnStartup";
import WhatsNewDialog from "@/modules/update/components/WhatsNewDialog.vue";
import { useTrayBehavior } from "@/modules/settings/composables/useTrayBehavior";
import { useProxySync } from "@/modules/settings/composables/useProxySync";
import { useNdSourceSync } from "@/modules/sources/navidrome/composables/useNdSourceSync";
import { useYmSourceSync } from "@/modules/sources/yandex/composables/useYmSourceSync";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { ephemeralFromPath } from "@/types/track";
import { stripExtension } from "@/lib/files/path";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import { useNowPlayingTitle } from "@/modules/player/composables/useNowPlayingTitle";
import { useExternalLinkInterceptor } from "@/composables/useExternalLinkInterceptor";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useCssVar, useEventListener } from "@vueuse/core";
import NetworkStatusToast from "@/components/NetworkStatusToast.vue";
import { useAnalysisQueueLifecycle } from "@/modules/recommendations/composables/useAnalysisQueueLifecycle";
import { getLogger } from "@/lib/logger";
import { applyStartupWindow } from "@/modules/settings/service/startup-window";
import { formatError } from "@/lib/errors";

const log = getLogger();
log.info(` \n
8""""8                                                
8    8 e   e eeeee e  eeeee eeeee eeeee  eeeee eeeeeee
8eeee8 8   8 8   8 8  8  88 8   8 8   8  8   8 8  8  8
88   8 8e  8 8e  8 8e 8   8 8e    8eee8e 8eee8 8e 8  8
88   8 88  8 88  8 88 8   8 88 "8 88   8 88  8 88 8  8
88   8 88ee8 88ee8 88 8eee8 88ee8 88   8 88  8 88 8  8
\n
Curious? Join us at https://github.com/Eg0r0k/Audiogram/issues :D
`);

const currentRoute = useRoute();
const { isMobileLayout } = useDeviceLayout();
const { init, stopAllWatchers } = useWatchedFolders();
const playerStore = usePlayerStore();
const queueStore = useQueueStore();
const rightPanelStore = useRightPanelStore();

const layouts: Record<string, VueComponent> = {
  default: DefaultLayout,
  blank: BlankLayout,
  mobile: MobileLayout,
};

// On a phone the top of the screen is the page header (back, sort), so toasts
// go to the bottom, just above the mini-player + nav dock. On desktop they stay
// on top, below the window toolbar (0px on the web). The toaster is portalled
// to body, so the dock height reaches it through a root variable.
const dockHeightVar = useCssVar("--mobile-dock-height");
watchEffect(() => {
  dockHeightVar.value = `${mobileDockHeight.value}px`;
});

const LayoutComponent = computed(() => {
  if (currentRoute.meta.layout === "blank") return BlankLayout;
  if (isMobileLayout.value) return MobileLayout;

  const layoutName = currentRoute.meta.layout ?? "default";
  return layouts[layoutName] ?? DefaultLayout;
});

useOpenedFiles((files) => {
  const tracks = files.map(file =>
    ephemeralFromPath(file.path, {
      title: stripExtension(file.name),
    }),
  );
  queueStore.setQueue(tracks, 0, { type: "external" })
    .catch(error => log.error(`[App] Queueing opened files failed: ${formatError(error)}`));
});

const { init: initGeneral, launchMinimized, closeToTray } = useGeneralSettings();

onMounted(async () => {
  if (platformCaps.hasNativeWindow) {
    applyStartupWindow({ launchMinimized: launchMinimized.value, closeToTray: closeToTray.value })
      .catch(error => log.error(`[App] Startup window failed: ${formatError(error)}`));
  }

  initGeneral().catch(error => log.error(`[App] General settings init failed: ${formatError(error)}`));

  if (platformCaps.hasGlobalShortcuts) {
    const [{ useTauriGlobalShortcuts }] = await Promise.all([
      import("@/modules/hotkeys/composables/useTauriGlobalShortcuts"),
    ]);

    useTauriGlobalShortcuts();
  }

  init().catch(error => log.error(`[App] Watched folders init failed: ${formatError(error)}`));
});
onUnmounted(() => {
  stopAllWatchers();
});

useTheme();
useAccentColor();
useSetupRootClasses();
usePreventPinchZoom();
useAudioSettings();
useGlobalHotKeys();
useMediaSession();
useDiscordPresence();
useTaskbarThumbbar();
useNowPlayingTitle();

useExternalLinkInterceptor();

useAnalysisQueueLifecycle();
useAppUpdates();
useChangelogOnStartup();

if (platformCaps.hasNativeWindow) useTrayBehavior();
if (platformCaps.hasNativeProxy) useProxySync();
if (platformCaps.canProxyStream) useNdSourceSync();
if (platformCaps.hasMediaServer) useYmSourceSync();

watch(() => currentRoute.fullPath, (fullPath) => {
  rightPanelStore.invalidateRouteScope(fullPath);
});

const stop = useEventListener(document, "click", () => {
  playerStore.unlockAudio().catch(error => log.error(`[App] Audio unlock on first click failed: ${formatError(error)}`));
  stop();
});

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
