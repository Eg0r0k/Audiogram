<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <IconExternalLink
            class="size-6"
          />
          Open external link?
        </DialogTitle>
        <DialogDescription>
          You are about to leave the app and open an external website.
        </DialogDescription>
      </DialogHeader>

      <div class="flex items-center gap-3 p-3 bg-muted rounded-lg">
        <IconLink
          class="size-5 text-muted-foreground shrink-0"
        />
        <span class="text-sm break-all">
          {{ displayUrl }}
        </span>
      </div>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button
          variant="destructive-link"
          @click="closeDialog"
        >
          Cancel
        </Button>
        <Button
          variant="link"
          @click="confirmNavigation"
        >
          Open link
          <IconExternalLink
            class="size-4"
          />
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Button from "@/components/ui/button/Button.vue";
import { useExternalLinkDialog } from "@/composables/dialog/useExternalLinkDialog";
import IconExternalLink from "~icons/tabler/external-link";
import IconLink from "~icons/tabler/link";

const { isOpen, pendingUrl, closeDialog, confirmNavigation } = useExternalLinkDialog();

const displayUrl = computed(() => {
  if (!pendingUrl.value) return "";

  try {
    const url = new URL(pendingUrl.value);
    return url.hostname + url.pathname;
  }
  catch {
    return pendingUrl.value;
  }
});
</script>
