<template>
  <Dialog
    :open="isOpen"
    @update:open="handleOpenChange"
  >
    <DialogContent class="flex flex-col max-h-[80vh] sm:max-w-2xl gap-0 p-0 overflow-hidden h-full">
      <div class="px-6 pt-5 pb-4">
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-1">
            <DialogTitle>
              {{ t("common.import.title", { count: current }) }}
            </DialogTitle>

            <p
              v-if="files.length < total"
              class="text-xs text-muted-foreground"
            >
              {{ t("common.import.visibleFiles", { visible: visibleFileCount, total }) }}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      <VirtualScrollable
        :items="files"
        :item-height="48"
        :padding-top="8"
        :padding-bottom="8"
        class="flex-1 min-h-0"
      >
        <template #default="{ item: file }">
          <Item
            :key="file.name"
            size="sm"
            class="mx-2 h-12 flex-nowrap py-0"
          >
            <ItemMedia>
              <IconLoader2
                v-if="file.status === 'pending'"
                class="size-5 shrink-0 animate-spin"
              />
              <IconCheck
                v-else-if="file.status === 'ok'"
                class="size-5 shrink-0 text-primary"
              />
              <IconMinus
                v-else-if="file.status === 'skipped'"
                class="size-5 shrink-0"
              />
              <IconAlertCircle
                v-else
                class="size-5 shrink-0"
              />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                {{ file.name }}
              </ItemTitle>

              <ItemDescription v-if="file.error">
                {{ file.error }}
              </ItemDescription>
            </ItemContent>
          </Item>
        </template>
      </VirtualScrollable>

      <Separator />
      <div class="px-4 py-3 flex gap-2">
        <Button
          v-if="!isRunning"
          size="lg"
          variant="destructive-link"
          :class="successCount > 0 ? '' : 'flex-1'"
          @click="handleClose"
        >
          {{ t("common.close") }}
        </Button>
        <Button
          v-if="!isRunning && successCount > 0"
          class="flex-1"
          size="lg"
          variant="ghost-primary"
          @click="goToLibrary"
        >
          {{ t("common.import.goToLibrary") }}
        </Button>

        <Button
          v-if="isRunning"
          size="lg"
          variant="ghost-primary"
          disabled
          class="flex-1"
        >
          {{ isCancelling ? t("common.import.status.cancelling") : isPaused ? t("common.import.status.paused") : t("common.import.status.running") }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>

  <Dialog
    :open="isCancelDialogOpen"
    @update:open="handleCancelDialogOpenChange"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{ t("common.import.status.cancelTitle") }}
        </DialogTitle>
        <DialogDescription>
          {{ t("common.import.status.cancelDescription") }}
        </DialogDescription>
      </DialogHeader>

      <DialogFooter>
        <Button
          variant="ghost-primary"
          :disabled="isCancelling"
          @click="continueImport"
        >
          {{ t("common.import.status.continueImport") }}
        </Button>
        <Button
          variant="destructive-link"
          :disabled="isCancelling"
          @click="confirmCancelImport"
        >
          {{ t("common.import.status.confirmCancel") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useImport } from "@/composables/useImport";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import VirtualScrollable from "@/components/ui/scrollable/VirtualScrollable.vue";
import { routeLocation } from "@/app/router/route-locations";
import IconCheck from "~icons/tabler/check";
import IconMinus from "~icons/tabler/minus";
import IconLoader2 from "~icons/tabler/loader-2";
import IconAlertCircle from "~icons/tabler/alert-circle";

const { t } = useI18n();
const router = useRouter();
const {
  isOpen,
  isRunning,
  isPaused,
  isCancelling,
  files,
  total,
  current,
  visibleFileCount,
  successCount,
  closeSheet,
  reset,
  pauseImport,
  resumeImport,
  cancelImport,
} = useImport();

const isCancelDialogOpen = ref(false);

function handleOpenChange(open: boolean) {
  if (open) return;

  if (isRunning.value) {
    pauseImport();
    isCancelDialogOpen.value = true;
    return;
  }

  handleClose();
}

function handleCancelDialogOpenChange(open: boolean) {
  isCancelDialogOpen.value = open;
  if (!open && isRunning.value && !isCancelling.value) {
    resumeImport();
  }
}

function handleClose() {
  closeSheet();
  reset();
}

function continueImport() {
  isCancelDialogOpen.value = false;
  resumeImport();
}

async function confirmCancelImport() {
  await cancelImport();
  isCancelDialogOpen.value = false;
  handleClose();
}

function goToLibrary() {
  closeSheet();
  reset();
  router.push(routeLocation.home());
}
</script>
