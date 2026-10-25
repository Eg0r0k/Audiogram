<template>
  <TrackContextMenu
    ref="coverMenu"
    context="current-track"
  >
    <div>
      <MorphingDialog
        :transition="{
          type: 'spring',
          bounce: 0.3,
          duration: 0.4,
        }"
      >
        <MorphingDialogTrigger
          class="block w-full select-none  rounded-lg overflow-hidden "
          @contextmenu="onCoverContextMenu"
        >
          <NuxtImage
            v-slot="{ imgAttrs, isLoaded, src: imageSrc }"
            :src="src"
            fallback-src="/img/fallback.svg"
            custom
          >
            <img
              :key="imageSrc"
              v-bind="imgAttrs"
              :src="imageSrc"
              alt=""
              class="aspect-square w-full object-cover transition-[transform,opacity] duration-180 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:scale-100 motion-reduce:transition-opacity motion-reduce:duration-150"
              :class="isLoaded ? 'scale-100 opacity-100' : 'scale-[1.02] opacity-0 motion-reduce:scale-100'"
            >
          </NuxtImage>
        </MorphingDialogTrigger>
        <MorphingDialogContainer>
          <MorphingDialogContent
            class="
            relative
            select-none
            overflow-hidden
            rounded-3xl
            bg-transparent
            shadow-none
          "
          >
            <NuxtImage
              v-slot="{ imgAttrs, isLoaded, src: imageSrc }"
              :src="src"
              fallback-src="/img/fallback.svg"
              class="
              h-auto
              w-full
              max-w-[90vw]
              object-cover
              lg:h-[70vh]
              lg:w-auto
            "
              custom
            >
              <img
                :key="imageSrc"
                v-bind="imgAttrs"
                :src="imageSrc"
                alt=""
                class="aspect-square w-full object-cover transition-[transform,opacity] duration-180 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:scale-100 motion-reduce:transition-opacity motion-reduce:duration-150"
                :class="isLoaded ? 'scale-100 opacity-100' : 'scale-[1.02] opacity-0 motion-reduce:scale-100'"
              >
            </NuxtImage>
            <MorphingDialogClose />
          </MorphingDialogContent>
        </MorphingDialogContainer>
      </MorphingDialog>
    </div>
  </TrackContextMenu>
</template>

<script setup lang="ts">
import { useTemplateRef } from "vue";
import NuxtImage from "@/components/ui/image/NuxtImage.vue";
import {
  MorphingDialog,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogTrigger,
} from "@/components/ui/motion/dialog";
import type { PlayerTrack } from "@/types/track";
import TrackContextMenu from "@/modules/tracks/components/menu/context-menu/TrackContextMenu.vue";

const props = defineProps<{
  src: string;
  track: PlayerTrack | null;
}>();

const coverMenu = useTemplateRef<InstanceType<typeof TrackContextMenu>>("coverMenu");

const onCoverContextMenu = (event: MouseEvent) => {
  if (!props.track) return;
  coverMenu.value?.open(props.track, 0, event);
};
</script>
