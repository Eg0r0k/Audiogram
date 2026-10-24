<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import IconX from "~icons/tabler/x";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const props = defineProps<{
  version: string;
  publishedAt: Date | null;
  loading?: boolean;
}>();

const { t, locale } = useI18n();

const formattedDate = computed(() => {
  if (!props.publishedAt) return "";
  return new Intl.DateTimeFormat(locale.value, { dateStyle: "long" }).format(props.publishedAt);
});
</script>

<template>
  <header class="flex shrink-0 items-center gap-4">
    <div class="min-w-0 flex-1">
      <DialogTitle class="text-xl leading-7 font-semibold text-balance">
        {{ t("update.whatsNewIn", { version }) }}
      </DialogTitle>
      <DialogDescription
        v-if="publishedAt"
        as-child
      >
        <time
          :datetime="publishedAt.toISOString()"
          class="block text-sm leading-5 font-normal text-muted-foreground"
        >{{ formattedDate }}</time>
      </DialogDescription>
      <div
        v-else-if="loading"
        class="flex h-5 items-center"
      >
        <Skeleton class="h-3.5 w-36" />
      </div>
    </div>
    <DialogClose as-child>
      <Button
        variant="ghost"
        color="muted"
        size="icon-md"
        class="-me-2 shrink-0 rounded-full"
        :aria-label="t('common.close')"
      >
        <IconX class="size-5" />
      </Button>
    </DialogClose>
  </header>
</template>
