<template>
  <div
    ref="dropZoneRef"
    class="app-grid  overflow-hidden h-dvh antialiased"
    :style="{
      paddingTop: top,
      paddingRight: right,
      paddingBottom: bottom,
      paddingLeft: left,
    }"
  >
    <WindowToolbar class="toolbar" />
    <!-- <Header class="header" /> -->
    <DropOverlay :show="isDragging" />
    <div class="content-area">
      <ResizableSidebar>
        <div class="relative flex-1 pt-4 h-full flex flex-col min-h-0 overflow-hidden">
          <SidebarHeader />
          <Scrollable class="min-h-0 flex-1">
            <Button variant="ghost">
              Test
            </Button>
          </Scrollable>
          <Button
            size="icon-xs"
            @click="handleThemeToggle"
          >
            <component :is="themeIcon" />
          </Button>
          <Button class="absolute bottom-4 right-4 size-12 rounded-full">
            <IconPlus class="size-6" />
          </Button>
        </div>
        <!-- <Tabs v-model="currentTab" class="flex flex-col h-full">
          <Scrollable
            :hide-thumb="true"
            direction="horizontal"
            class="shrink-0"
          >
            <TabsList>
              <TabsTrigger value="music">Music</TabsTrigger>
              <TabsTrigger value="podcasts">Podcasts</TabsTrigger>
              <TabsTrigger value="audiobooks">Audiobooks</TabsTrigger>
            </TabsList>
          </Scrollable>

          <div
            ref="swipeContainer"
            class="flex-1 h-full relative min-h-0 overflow-hidden flex flex-col"
          >
            <Scrollable direction="vertical" class="flex-1 w-full">
              <TabsContent value="music" class="mt-0 p-1">
                <Button variant="ghost" class="w-full">
                  <Icon icon="tabler:music" />
                  Music
                </Button>
              </TabsContent>

              <TabsContent value="podcasts" class="mt-0 p-1">
                <Button
                  v-for="i in 20"
                  :key="i"
                  variant="destructive-link"
                  class="w-full"
                >
                  <Icon icon="tabler:music" />
                  Music {{ i }}
                </Button>
              </TabsContent>

              <TabsContent value="audiobooks" class="mt-0"> </TabsContent>
            </Scrollable>
          </div>
        </Tabs> -->
      </ResizableSidebar>

      <main
        class="main"
      >
        <slot />
      </main>
    </div>

    <FooterMediaPlayer class="footer" />
  </div>
</template>

<script setup lang="ts">
import { useScreenSafeArea } from "@vueuse/core";
import WindowToolbar from "@/components/WindowToolbar.vue";
import FooterMediaPlayer from "@/components/layout/footer/FooterMediaPlayer.vue";
import ResizableSidebar from "@/components/layout/sidebar/ResizableSidebar.vue";
import { computed } from "vue";
import DropOverlay from "@/components/layout/dropzone/DropOverlay.vue";
import { useFileDrop } from "@/composables/useFileDrop";
import { useTheme } from "@/composables/useTheme";
import { Moon, Sun } from "lucide-vue-next";
import IconPlus from "~icons/tabler/plus";

import Button from "@/components/ui/button/Button.vue";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import SidebarHeader from "@/components/layout/sidebar/header/SidebarHeader.vue";

function processFiles(files: File[]) {
  files.forEach((file) => {
    console.log("File:", file.name);
    // @ts-expect-error- relativePath добавляется динамически
    console.log("Path:", file.relativePath || file.path || file.name);
  });
}

const theme = useTheme();
const themeIcon = computed(() => (theme.isDark.value ? Sun : Moon));
const handleThemeToggle = (event: MouseEvent) => {
  theme.toggleTheme(event);
};

const { isDragging } = useFileDrop({
  acceptedExtensions: [".mp3", ".flac", ".wav", ".ogg"],
  onDrop: (files) => {
    console.log("Dropped:", files);
    processFiles(files);
  },
});

const { top, right, bottom, left } = useScreenSafeArea();
// const swipeContainer = ref<HTMLElement | null>(null);
// const TABS = ["music", "podcasts", "audiobooks"];
// const currentTab = ref("music");
// const nextTab = () => {
//   const currentIndex = TABS.indexOf(currentTab.value);
//   if (currentIndex < TABS.length - 1) {
//     currentTab.value = TABS[currentIndex + 1];
//   } else {
//     currentTab.value = TABS[0];
//   }
// };

// const prevTab = () => {
//   const currentIndex = TABS.indexOf(currentTab.value);
//   if (currentIndex > 0) {
//     currentTab.value = TABS[currentIndex - 1];
//   } else {
//     currentTab.value = TABS[TABS.length - 1];
//   }
// };

// useSwipeControl(swipeContainer, {
//   threshold: 70,
//   onSwipeLeft: nextTab,
//   onSwipeRight: prevTab,
// });
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
