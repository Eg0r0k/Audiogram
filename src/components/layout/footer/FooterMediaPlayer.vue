<script setup lang="ts">
import SidebarMusic from "@/modules/player/components/SidebarMusic.vue";
import PlayBarControls from "@/modules/player/components/PlayBarControls.vue";
import SidebarControls from "@/modules/player/components/SidebarControls.vue";
import FooterProgress from "./FooterProgress.vue";
</script>

<template>
  <footer>
    <aside>
      <div class="relative flex items-center justify-between ">
        <FooterProgress />

        <SidebarMusic />
        <PlayBarControls />

        <SidebarControls />
      </div>
    </aside>
  </footer>
</template>
