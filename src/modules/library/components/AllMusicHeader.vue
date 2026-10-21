<template>
  <header
    class="relative mx-auto w-full max-w-page shrink-0 bg-card px-4"
    :class="mobile ? 'h-16 pt-2' : 'h-[72px]'"
  >
    <Motion
      class="relative flex h-full items-center gap-2"
      :animate="selecting ? HIDDEN_UP : SHOWN"
      :transition="swapTransition"
      :inert="selecting || undefined"
    >
      <Button
        variant="ghost"
        color="muted"
        size="icon-lg"
        class="shrink-0 rounded-full"
        :aria-label="searchExpanded ? t('search.close') : t('common.back')"
        @click="onBack"
      >
        <IconArrowLeft class="size-6" />
      </Button>

      <h1
        class="min-w-0 flex-1 truncate font-bold transition-opacity duration-short-4 ease-standard"
        :class="[mobile ? 'text-xl' : 'text-2xl', { 'opacity-0': mobile && searchExpanded }]"
      >
        {{ t('library.allMusic.title') }}
      </h1>

      <template v-if="mobile">
        <div
          class="flex shrink-0 items-center gap-1 transition-opacity duration-short-4 ease-standard"
          :class="{ 'pointer-events-none opacity-0': searchExpanded }"
          :inert="searchExpanded || undefined"
        >
          <Button
            variant="ghost"
            color="muted"
            size="icon-lg"
            class="rounded-full"
            :aria-label="t('nav.search')"
            @click="openSearch"
          >
            <IconSearch class="size-6" />
          </Button>
          <Button
            variant="ghost"
            color="muted"
            size="icon-lg"
            class="rounded-full"
            :aria-label="t('track.contextMenu.select')"
            @click="emit('select')"
          >
            <IconListCheck class="size-6" />
          </Button>
        </div>

        <Transition
          enter-active-class="transition-[width,opacity] duration-medium-2 ease-standard motion-reduce:transition-none"
          leave-active-class="transition-[width,opacity] duration-short-4 ease-standard motion-reduce:transition-none"
          enter-from-class="w-10! opacity-0"
          leave-to-class="w-10! opacity-0"
        >
          <div
            v-if="searchExpanded"
            class="absolute inset-y-0 right-0 flex w-[calc(100%-3rem)] items-center overflow-hidden"
          >
            <AllMusicSearchField
              ref="mobileField"
              v-model:search="search"
              v-model:sort-key="sortKey"
              class="w-full"
              @escape="onEscape"
            />
          </div>
        </Transition>
      </template>

      <template v-else>
        <AllMusicSearchField
          v-model:search="search"
          v-model:sort-key="sortKey"
          class="w-full max-w-sm"
          @escape="onEscape"
        />
        <Button
          variant="ghost"
          color="muted"
          size="icon-lg"
          class="shrink-0 rounded-full"
          :aria-label="t('track.contextMenu.select')"
          :title="t('track.contextMenu.select')"
          @click="emit('select')"
        >
          <IconListCheck class="size-6" />
        </Button>
      </template>
    </Motion>

    <AnimatePresence>
      <Motion
        v-if="selecting"
        key="selection"
        class="absolute inset-0 px-4"
        :initial="HIDDEN_DOWN"
        :animate="SHOWN"
        :exit="HIDDEN_DOWN"
        :transition="swapTransition"
      >
        <slot name="selection" />
      </Motion>
    </AnimatePresence>
  </header>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import { AnimatePresence, Motion } from "motion-v";
import { Button } from "@/components/ui/button";
import type { TrackSortKey } from "@/modules/tracks/types";
import IconArrowLeft from "~icons/tabler/arrow-left";
import IconListCheck from "~icons/tabler/list-check";
import IconSearch from "~icons/tabler/search";
import AllMusicSearchField from "./AllMusicSearchField.vue";

const props = defineProps<{
  /** Selection mode: the `selection` slot takes the header's place. */
  selecting: boolean;
  /** Phone header: a smaller title and the search behind an icon. */
  mobile: boolean;
}>();

const search = defineModel<string>("search", { required: true });
const sortKey = defineModel<TrackSortKey | null>("sortKey", { required: true });

const emit = defineEmits<{
  back: [];
  select: [];
  searchEscape: [];
}>();

const { t } = useI18n();

const SHOWN = { opacity: 1, y: 0 };
const HIDDEN_UP = { opacity: 0, y: -12 };
const HIDDEN_DOWN = { opacity: 0, y: 12 };
const swapTransition = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const };

const searchOpen = ref(false);
// A typed query keeps the field out even when the layout switches to the
// phone one mid-search, so the list is never filtered by text nobody sees.
const searchExpanded = computed(() => searchOpen.value || search.value !== "");

const mobileField = useTemplateRef<InstanceType<typeof AllMusicSearchField>>("mobileField");

const openSearch = async () => {
  searchOpen.value = true;
  await nextTick();
  mobileField.value?.focus();
};

const closeSearch = () => {
  searchOpen.value = false;
  search.value = "";
};

const onBack = () => {
  if (searchExpanded.value) closeSearch();
  else emit("back");
};

const onEscape = () => {
  if (props.mobile) closeSearch();
  emit("searchEscape");
};
</script>
