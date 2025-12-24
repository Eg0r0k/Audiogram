<script setup lang="ts">
import PlayBarControls from "@/components/player/PlayBarControls.vue";
import PlayerBarNotification from "@/components/player/PlayerBarNotification.vue";
import SidebarControls from "@/components/player/SidebarControls.vue";
import SidebarMusic from "@/components/player/SidebarMusic.vue";
import { AnimatePresence, Motion } from "motion-v";
import { ref } from "vue";
import FooterMobile from "./FooterMobile.vue";
import RangeSelector from "@/components/player/RangeSelector.vue";
const isOpen = ref(false);

const progress = ref(0);

</script>

<template>
  <footer
    class="p-2 bg-card border-t border-background"
  >
    <aside>
      <div class="relative flex items-center justify-between h-[63px]">
        <div class=" absolute -left-[7px]  -top-[9px] -right-[7px]">
          <RangeSelector
            v-model="progress"
            :step="0.016666666666666666"
            :keyboard-step="5"
            :min="0"
            :max="100"
            :use-transform="true"
          />
        </div>
        <SidebarMusic />
        <PlayBarControls />
        <SidebarControls />
      </div>
      <AnimatePresence>
        <Motion
          v-if="isOpen"
          :initial="{
            opacity: 0,
            y: 20,
            height: 0,
          }"
          :animate="{
            opacity: 1,
            y: 0,
            height: 'auto',
          }"
          :exit="{
            opacity: 0,
            y: 20,
            height: 0,
          }"
          :transition="{
            duration: 0.2,
            ease: 'easeInOut',
          }"
          class="overflow-hidden"
        >
          <PlayerBarNotification />
        </Motion>
      </AnimatePresence>
    </aside>
    <FooterMobile class="hidden" />
  </footer>
</template>
