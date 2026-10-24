<script setup lang="ts">
import { useI18n } from "vue-i18n";
import IconArrowUpRight from "~icons/tabler/arrow-up-right";
import IconBrandGithub from "~icons/tabler/brand-github";
import IconCloudOff from "~icons/tabler/cloud-off";
import IconNews from "~icons/tabler/news";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReleaseNotesStatus } from "../composables/useReleaseNotesDialog";
import ReleaseNotesContent from "./ReleaseNotesContent.vue";

defineProps<{
  view: ReleaseNotesStatus;
  html: string;
  version: string;
  releaseUrl: string;
  releasesUrl: string;
}>();

const emit = defineEmits<{
  retry: [];
}>();

const { t } = useI18n();

const SKELETON_ITEMS = [
  { title: "w-40", lines: ["w-full", "w-3/4"] },
  { title: "w-28", lines: ["w-5/6"] },
  { title: "w-48", lines: ["w-full", "w-2/3"] },
  { title: "w-36", lines: ["w-11/12", "w-1/2"] },
];
</script>

<template>
  <div class="px-6 pb-6">
    <div
      v-if="view === 'loading'"
      role="status"
    >
      <span class="sr-only">{{ t("update.notesLoading") }}</span>
      <Skeleton class="aspect-video w-full rounded-[10px]" />
      <div class="mt-8 mb-3 text-base leading-6">
        <Skeleton
          variant="text"
          class="w-32"
        />
      </div>
      <div class="space-y-4 text-sm leading-5">
        <div
          v-for="(item, index) in SKELETON_ITEMS"
          :key="index"
        >
          <Skeleton
            variant="text"
            :class="item.title"
          />
          <div class="mt-1">
            <Skeleton
              v-for="line in item.lines"
              :key="line"
              variant="text"
              :class="line"
            />
          </div>
        </div>
      </div>
    </div>

    <Empty
      v-else-if="view === 'error'"
      size="sm"
      class="py-12"
    >
      <EmptyHeader role="alert">
        <EmptyMedia>
          <IconCloudOff />
        </EmptyMedia>
        <EmptyTitle>
          {{ t("update.notesFailed") }}
        </EmptyTitle>
        <EmptyDescription>{{ t("update.notesFailedHint") }}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent class="flex-row flex-wrap justify-center gap-2">
        <Button @click="emit('retry')">
          {{ t("update.tryAgain") }}
        </Button>
        <Button
          as="a"
          :href="releaseUrl"
          variant="ghost"
          color="neutral"
        >
          <IconBrandGithub />
          {{ t("update.openOnGithub") }}
        </Button>
      </EmptyContent>
    </Empty>

    <Empty
      v-else-if="view === 'empty'"
      size="sm"
      class="py-12"
    >
      <EmptyHeader>
        <EmptyMedia>
          <IconNews />
        </EmptyMedia>
        <EmptyTitle>{{ t("update.noNotes", { version }) }}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button
          as="a"
          :href="releasesUrl"
          variant="ghost"
          color="neutral"
        >
          <IconBrandGithub />
          {{ t("update.allReleases") }}
        </Button>
      </EmptyContent>
    </Empty>

    <template v-else>
      <ReleaseNotesContent :html="html" />
      <a
        :href="releaseUrl"
        class="mt-8 inline-flex items-center gap-2 rounded-sm text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:focus-ring"
      >
        <IconBrandGithub
          class="size-4"
          aria-hidden="true"
        />
        {{ t("update.viewRelease") }}
        <IconArrowUpRight
          class="size-4"
          aria-hidden="true"
        />
      </a>
    </template>
  </div>
</template>
