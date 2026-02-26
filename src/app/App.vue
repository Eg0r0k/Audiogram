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
  <ExternalLinkDialog />
  <Toaster
    position="top-center"
    class="pointer-events-auto"
  />
</template>

<script setup lang="ts">
import "vue-sonner/style.css";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "vue-sonner";
import { type Component, computed, onMounted, onUnmounted } from "vue";
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

const route = useRoute();
const { isMobileLayout } = useDeviceLayout();

const layouts: Record<string, Component> = {
  default: DefaultLayout,
  blank: BlankLayout,
  mobile: MobileLayout,
};

const LayoutComponent = computed(() => {
  if (route.meta.layout === "blank") return BlankLayout;

  if (isMobileLayout) return MobileLayout;

  const layoutName = route.meta.layout ?? "default";
  return layouts[layoutName] ?? DefaultLayout;
});

let unlisten: (() => void) | null = null;
const { init: initGeneral } = useGeneralSettings();

onMounted(async () => {
  initGeneral();
  unlisten = await listenForOpenedFiles((files: OpenedFile[]) => {
    files.forEach((file) => {
      toast.success(`▶️ Воспроизводится: ${file.name}`, {
        description: file.path,
        duration: 5000,
      });
    });
  });
});

onUnmounted(() => {
  unlisten?.();
});

useTheme();
useAccentColor();
useSetupRootClasses();
usePreventPinchZoom();
useAudioSettings();
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
