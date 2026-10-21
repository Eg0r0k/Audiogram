<template>
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
        variant="ghost"
        @click="dismiss"
      >
        {{ $t("common.cancel") }}
      </Button>
      <Button
        variant="ghost"
        @click="close(true)"
      >
        {{ $t("common.externalLink.openLink") }}
        <IconExternalLink class="size-4" />
      </Button>
    </DialogFooter>
  </DialogContent>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialogContext,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import IconExternalLink from "~icons/tabler/external-link";
import IconLink from "~icons/tabler/link";

const props = defineProps<{
  url: string;
}>();

const { close, dismiss } = useDialogContext<true>();

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
