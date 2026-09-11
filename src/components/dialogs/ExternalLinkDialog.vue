<template>
  <Dialog
    :open="open"
    @update:open="value => emit('update:open', value)"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <IconExternalLink class="size-6" />
          {{ $t("common.externalLink.title") }}
        </DialogTitle>
        <DialogDescription>
          {{ $t("common.externalLink.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex items-center gap-3 p-3 bg-muted rounded-lg">
        <IconLink class="size-5 text-muted-foreground shrink-0" />
        <span class="text-sm break-all">
          {{ displayUrl }}
        </span>
      </div>

      <DialogFooter class="gap-2 sm:gap-0">
        <Button
          variant="destructive-link"
          @click="dismiss"
        >
          {{ $t("common.cancel") }}
        </Button>
        <Button
          variant="link"
          @click="resolve(true)"
        >
          {{ $t("common.externalLink.openLink") }}
          <IconExternalLink class="size-4" />
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
import { Button } from "@/components/ui/button";
import { useSummonedDialog } from "@/components/dialogs/summon";
import IconExternalLink from "~icons/tabler/external-link";
import IconLink from "~icons/tabler/link";

const props = defineProps<{
  open: boolean;
  url: string;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
}>();

const { resolve, dismiss } = useSummonedDialog<true>();

const displayUrl = computed(() => {
  try {
    const url = new URL(props.url);
    return url.hostname + url.pathname;
  }
  catch {
    return props.url;
  }
});
</script>
