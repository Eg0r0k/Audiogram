<template>
  <EntitySelectPanel
    v-model:search="search"
    :title="t('track.edit.selectArtists')"
    :items="suggestions"
    :get-key="(artist: ArtistEntity) => artist.id"
    :can-create="canCreate"
    :confirm-count="selectedNames.length"
    :show-confirm="isDirty"
    :reveal-key="revealKey"
    @confirm="handleConfirm"
    @create="handleCreate"
    @back="handleDone"
    @close="rightPanel.close()"
  >
    <template #row="{ item }">
      <Item
        as="button"
        type="button"
        class="w-full cursor-pointer gap-3 px-2 py-2 text-left"
        @click="toggleName(item.name)"
      >
        <ItemMedia>
          <EntityCoverImage
            owner-type="artist"
            :owner-id="item.id"
            :alt="item.name"
            image-class="size-10 rounded-full object-cover"
          />
        </ItemMedia>
        <ItemContent class="min-w-0">
          <ItemTitle class="w-full text-sm font-normal">
            <span class="min-w-0 truncate">{{ item.name }}</span>
          </ItemTitle>
        </ItemContent>
        <ItemActions>
          <IconCheck
            v-if="isSelectedName(item.name)"
            class="size-5 text-primary"
          />
        </ItemActions>
      </Item>
    </template>
  </EntitySelectPanel>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { refDebounced } from "@vueuse/core";
import { keepPreviousData, useQuery } from "@tanstack/vue-query";
import { useI18n } from "vue-i18n";
import { EntitySelectPanel } from "@/components/entity-select";
import { identityKey, sameArtistNames } from "@/lib/artist-names";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import EntityCoverImage from "@/components/ui/EntityCoverImage.vue";
import type { ArtistEntity } from "@/db/entities";
import { searchArtists } from "@/queries/artist.queries";
import { queryKeys } from "@/queries/query-keys";
import { useRightPanelStore } from "@/modules/right-panel/store/right-panel.store";
import { usePanelUiBack } from "@/modules/right-panel/composables/usePanelUiBack";
import type { RightPanelEntitySelectPayload } from "@/modules/right-panel/types";
import IconCheck from "~icons/tabler/check";

const props = defineProps<{ payload: RightPanelEntitySelectPayload }>();

const { t } = useI18n();
const rightPanel = useRightPanelStore();

const search = ref("");
const debouncedSearch = refDebounced(search, 200);
const normalizedSearch = computed(() => debouncedSearch.value.trim().replace(/\s+/g, " "));

const initialNames = computed<readonly string[]>(() => props.payload.selectedNames ?? []);
const selectedNames = ref<string[]>([]);
watch(initialNames, (names) => {
  selectedNames.value = [...names];
}, { immediate: true });
const isSelectedName = (name: string) => selectedNames.value.some(item => identityKey(item) === identityKey(name));

const toggleName = (name: string) => {
  selectedNames.value = isSelectedName(name)
    ? selectedNames.value.filter(item => identityKey(item) !== identityKey(name))
    : [...selectedNames.value, name];
};

const PICKER_LIMIT = 1000;

const { data } = useQuery({
  queryKey: computed(() => queryKeys.artists.search(normalizedSearch.value)),
  queryFn: () => searchArtists(normalizedSearch.value, PICKER_LIMIT),
  placeholderData: keepPreviousData,
});
const suggestions = computed(() =>
  [...(data.value ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
);

// Confirm follows "something changed", not "something selected": clearing
// the last artist is a valid outcome (the track becomes artist-less).
const isDirty = computed(() => !sameArtistNames(selectedNames.value, initialNames.value));

// The picker opens on the first of the track's current artists in list order.
const initialNameKeys = computed(() => new Set(initialNames.value.map(identityKey)));
const revealKey = computed(() =>
  suggestions.value.find(artist => initialNameKeys.value.has(identityKey(artist.name)))?.id ?? null,
);

const canCreate = computed(() =>
  normalizedSearch.value.length > 0
  && !suggestions.value.some(artist => identityKey(artist.name) === identityKey(normalizedSearch.value)),
);

const handleCreate = (name: string) => {
  if (!isSelectedName(name)) selectedNames.value = [...selectedNames.value, name];
  search.value = "";
};

const handleDone = () => {
  if (props.payload.onDone) {
    props.payload.onDone();
    return;
  }

  rightPanel.back();
};
usePanelUiBack(handleDone);

const handleConfirm = () => {
  props.payload.onConfirm({ names: [...selectedNames.value] });
  handleDone();
};
</script>
