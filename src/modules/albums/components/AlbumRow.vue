<template>
  <div
    v-ripple
    class=" flex group  cursor-pointer select-none flex-col p-3 gap-2  rounded-sm text-pretty min-w-36 w-full"
  >
    <div class="relative z-10  aspect-square rounded-md overflow-hidden bg-muted shadow-sm group-hover:shadow-md transition-shadow">
      <NuxtImage
        :src="album.coverPath"
        :alt="album.title"
        :placeholder="true"
        fallback-src="/img/fallback.svg"
        class="size-full  object-cover "
      />

      <div
        class="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2 sm:p-3"
      >
        <Button
          size="icon-lg"
          class="rounded-full size-12  translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300s"
          @click.prevent="handlePlay"
        >
          <IconPlay class="size-5 fill-current" />
        </Button>
      </div>
    </div>
    <div class="flex flex-col">
      <span class=" font-semibold">
        {{ album.title }}
      </span>
      <span class="text-sm text-muted-foreground truncate">
        {{ artistName }}
      </span>
    </div>
  </div>
</template>
<script lang="ts" setup>
import { Button } from "@/components/ui/button";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import { AlbumEntity } from "@/db/entities";
import IconPlay from "~icons/tabler/player-play-filled";

const props = defineProps<{
  album: AlbumEntity;
  artistName: string;
}>();

const handlePlay = () => {

};

</script>
