<template>
  <div class="flex h-full flex-col gap-8 overflow-auto p-6">
    <header class="flex flex-wrap items-end gap-6">
      <div class="flex flex-col gap-1">
        <h1 class="text-xl font-bold text-balance">
          Маскоты-заглушки
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ variantCount }} вариантов. Детали лежат в <code>src/assets/mascot/&lt;slot&gt;/</code>, черновики начинаются с «_».
        </p>
      </div>
      <label class="flex min-w-72 flex-1 flex-col gap-2 text-sm">
        <span>Id для проверки</span>
        <input
          v-model="seed"
          class="h-10 rounded-md bg-muted px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          spellcheck="false"
        >
      </label>
    </header>

    <section class="flex flex-wrap items-center gap-6">
      <img
        :src="coverUrl"
        alt=""
        width="232"
        height="232"
        class="rounded-md"
      >
      <img
        :src="coverUrl"
        alt=""
        width="55"
        height="55"
        class="rounded-md"
      >
      <img
        :src="artistUrl"
        alt=""
        width="55"
        height="55"
        class="rounded-full"
      >
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <template
          v-for="(value, key) in traits"
          :key="key"
        >
          <dt class="text-muted-foreground">
            {{ key }}
          </dt>
          <dd class="font-mono">
            {{ value }}
          </dd>
        </template>
      </dl>
    </section>

    <section
      v-for="slot in slots"
      :key="slot.slot"
      class="flex flex-col gap-3"
    >
      <h2 class="font-bold">
        {{ slot.slot }} · {{ slot.liveCount }}
      </h2>
      <ul class="flex flex-wrap gap-3">
        <li
          v-for="part in slot.parts"
          :key="part.name"
          class="flex w-20 flex-col items-center gap-1"
          :title="part.file"
        >
          <img
            :src="part.url"
            alt=""
            width="72"
            height="72"
            class="rounded-md"
            :class="part.draft && 'opacity-60 outline-1 outline-dashed outline-muted-foreground'"
          >
          <span class="max-w-20 truncate text-xs">{{ part.name }}</span>
          <span
            v-if="part.draft"
            class="text-xs text-muted-foreground"
          >черновик</span>
        </li>
      </ul>
    </section>

    <section class="flex flex-col gap-3">
      <div class="flex items-center gap-3">
        <h2 class="font-bold">
          Случайные id
        </h2>
        <button
          type="button"
          class="h-8 rounded-md bg-muted px-3 text-sm hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring"
          @click="shuffle"
        >
          Перемешать
        </button>
      </div>
      <ul class="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-3">
        <li
          v-for="id in randomIds"
          :key="id"
        >
          <button
            type="button"
            class="block"
            :title="id"
            @click="seed = id"
          >
            <img
              :src="mascotCoverUrl(id)"
              alt=""
              width="64"
              height="64"
              class="rounded-md"
            >
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import {
  artistFallbackUrl,
  COVER_GRADIENTS,
  MASCOT_PARTS,
  MASCOT_SLOTS,
  mascotCoverUrl,
  mascotTraits,
  mascotUrlForTraits,
  mascotVariantCount,
} from "@/modules/covers/lib/placeholder";

const route = useRoute();
const seed = ref(typeof route.query.seed === "string" ? route.query.seed : "Новый плейлист");

// Pages are keyed by fullPath (App.vue): a router.replace per keystroke would
// remount the stand and drop the input's focus, so the URL changes past the router.
watch(seed, (value) => {
  const url = new URL(window.location.href);
  url.searchParams.set("seed", value);
  history.replaceState(history.state, "", url);
});

const traits = computed(() => mascotTraits(seed.value));
const coverUrl = computed(() => mascotCoverUrl(seed.value));
const artistUrl = computed(() => artistFallbackUrl(seed.value));
const variantCount = mascotVariantCount();

// Every part, drafts included, on the current id's mascot with only its slot swapped.
const slots = computed(() => [
  {
    slot: "gradient",
    liveCount: COVER_GRADIENTS.length,
    parts: COVER_GRADIENTS.map(gradient => ({
      name: gradient.name,
      draft: false,
      file: "gradients.ts",
      url: mascotUrlForTraits({ ...traits.value, gradient: gradient.name }),
    })),
  },
  ...MASCOT_SLOTS.map(slot => ({
    slot,
    liveCount: MASCOT_PARTS[slot].filter(part => !part.draft).length,
    parts: MASCOT_PARTS[slot].map(part => ({
      name: part.name,
      draft: part.draft,
      file: `src/assets/mascot/${slot}/${part.draft ? "_" : ""}${part.name}${part.back ? ".back" : ""}.svg`,
      url: mascotUrlForTraits({ ...traits.value, [slot]: part.name }),
    })),
  })),
]);

const randomIds = ref<string[]>([]);
const shuffle = () => {
  randomIds.value = Array.from({ length: 48 }, () => crypto.randomUUID());
};
shuffle();
</script>
