<template>
  <div class="flex flex-col gap-3">
    <Input
      v-model="query"
      placeholder="Поиск: название или артист"
    />
    <div
      v-if="results.length"
      class="flex max-h-64 flex-col overflow-auto rounded-lg border"
    >
      <button
        v-for="t in results"
        :key="t.id"
        class="px-3 py-1.5 text-left text-sm hover:bg-muted"
        @click="choose(t.id)"
      >
        <span class="font-medium">{{ t.title }}</span>
        <span class="text-muted-foreground"> — {{ t.artistName }}</span>
      </button>
    </div>
    <div class="flex gap-2">
      <Button
        variant="secondary"
        size="sm"
        @click="$emit('pickCurrent')"
      >
        Играющий сейчас
      </Button>
      <Button
        variant="secondary"
        size="sm"
        @click="$emit('pickRandom')"
      >
        Случайный из истории
      </Button>
    </div>
    <div
      v-if="source"
      class="flex items-center gap-3 rounded-lg border p-3"
    >
      <EntityCoverImage
        owner-type="track"
        :owner-id="source.id"
        :alt="source.title"
        image-class="size-14 rounded"
      />
      <div class="min-w-0">
        <div class="text-xs text-muted-foreground">
          Стартовый трек потока
        </div>
        <div class="truncate font-medium">
          {{ source.title }}
        </div>
        <div class="truncate text-sm text-muted-foreground">
          {{ source.artistName }}
        </div>
        <div class="text-xs text-muted-foreground">
          {{ source.tagIds.length }} тегов · {{ source.playCount }} прослушиваний
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import EntityCoverImage from "@/components/ui/EntityCoverImage.vue";
import type { TrackEntity } from "@/db/entities";
import type { TrackId } from "@/types/ids";

const props = defineProps<{ source: TrackEntity | null; search: (q: string) => TrackEntity[] }>();
const emit = defineEmits<{ select: [id: TrackId]; pickCurrent: []; pickRandom: [] }>();

const query = ref("");
const results = computed(() => props.search(query.value));

const choose = (id: TrackId) => {
  emit("select", id);
  query.value = "";
};
</script>
