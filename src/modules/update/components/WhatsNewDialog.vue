<script setup lang="ts">
import { computed } from "vue";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import { useDeviceLayout } from "@/composables/useDeviceLayout";
import { useReleaseNotesDialog } from "../composables/useReleaseNotesDialog";
import { renderReleaseNotes } from "../lib/release-notes";
import { useChangelogStore } from "../store/changelog.store";
import WhatsNewBody from "./WhatsNewBody.vue";
import WhatsNewHeader from "./WhatsNewHeader.vue";

const changelogStore = useChangelogStore();
const { isMobileLayout } = useDeviceLayout();
const { version, status, body, publishedAt, releaseUrl, releasesUrl, retry } = useReleaseNotesDialog();

const notes = computed(() => (status.value === "ready" ? renderReleaseNotes(body.value) : null));
const view = computed(() => (notes.value?.isEmpty ? "empty" : status.value));
const html = computed(() => notes.value?.html ?? "");

const handleOpenChange = (open: boolean) => {
  if (!open) changelogStore.closeDialog();
};

// The open after an update has no pointer, so focus on the close button would paint its ring.
const focusSurface = (event: Event) => {
  event.preventDefault();
  if (event.target instanceof HTMLElement) event.target.focus();
};
</script>

<template>
  <Drawer
    v-if="isMobileLayout"
    :open="changelogStore.isDialogOpen"
    @update:open="handleOpenChange"
  >
    <DrawerContent
      class="top-[calc(var(--toolbar-height)+env(safe-area-inset-top,0px)+1.5rem)]"
      @open-auto-focus="focusSurface"
    >
      <WhatsNewHeader
        class="px-6 pb-4"
        :loading="view === 'loading'"
        :version="version"
        :published-at="publishedAt"
      />
      <Scrollable class="min-h-0 flex-1">
        <WhatsNewBody
          :view="view"
          :html="html"
          :version="version"
          :release-url="releaseUrl"
          :releases-url="releasesUrl"
          @retry="retry"
        />
      </Scrollable>
    </DrawerContent>
  </Drawer>

  <Dialog
    v-else
    :open="changelogStore.isDialogOpen"
    @update:open="handleOpenChange"
  >
    <DialogContent
      :show-close-button="false"
      :data-status="view"
      class="
        top-[calc(50%+var(--toolbar-height)/2)] max-w-2xl gap-0 overflow-hidden p-0
        [--whats-new-cap:min(840px,calc(100vh-var(--toolbar-height)-96px))]
        supports-[height:100dvh]:[--whats-new-cap:min(840px,calc(100dvh-var(--toolbar-height)-96px))]
        max-h-(--whats-new-cap) supports-[height:100dvh]:max-h-(--whats-new-cap)
        data-[status=loading]:h-(--whats-new-cap)
      "
      @open-auto-focus="focusSurface"
    >
      <WhatsNewHeader
        class="px-6 pt-5 pb-4"
        :loading="view === 'loading'"
        :version="version"
        :published-at="publishedAt"
      />
      <Scrollable
        fit-content
        class="min-h-0"
      >
        <WhatsNewBody
          :view="view"
          :html="html"
          :version="version"
          :release-url="releaseUrl"
          :releases-url="releasesUrl"
          @retry="retry"
        />
      </Scrollable>
    </DialogContent>
  </Dialog>
</template>
