<template>
  <Dialog
    :open="changelogStore.isDialogOpen"
    @update:open="handleOpenChange"
  >
    <DialogContent class="flex flex-col max-h-[80vh] sm:max-w-2xl gap-0 p-0 overflow-hidden h-full">
      <div class="border-b px-6 py-5 shrink-0">
        <DialogHeader class="gap-2 pr-10">
          <div class="flex items-center gap-2">
            <span class="inline-flex rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              v{{ activeVersion }}
            </span>
            <span class="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Release notes
            </span>
          </div>
          <DialogTitle>What's new</DialogTitle>
          <DialogDescription>
            Changes included in this release.
          </DialogDescription>
        </DialogHeader>
      </div>

      <Scrollable class="flex-1 min-h-0">
        <ReleaseNotesContent
          class="p-4"
          :markdown="activeChangelog"
        />
      </Scrollable>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, watch } from "vue";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReleaseNotesContent from "./ReleaseNotesContent.vue";
import { EMPTY_RELEASE_NOTES_MESSAGE } from "../lib/releaseNotes";
import { useChangelogStore } from "../store/changelog.store";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import DialogContent from "@/components/ui/dialog/DialogContent.vue";

const changelogStore = useChangelogStore();

const activeVersion = computed(() => changelogStore.activeVersion ?? __APP_VERSION__);
const activeChangelog = computed(
  () => changelogStore.activeChangelog ?? EMPTY_RELEASE_NOTES_MESSAGE,
);

watch(
  () => changelogStore.hasUnseenUpdate,
  (hasUnseenUpdate) => {
    if (!hasUnseenUpdate || changelogStore.isDialogOpen) return;
    changelogStore.openPending();
  },
  { immediate: true },
);

const handleOpenChange = (open: boolean) => {
  if (!open) {
    changelogStore.closeDialog();
  }
};
</script>
