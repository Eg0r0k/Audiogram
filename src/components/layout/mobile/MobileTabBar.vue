<template>
  <nav
    class="flex select-none  border-t dark:border-background border-border items-stretch shrink-0 h-14 px-2 py-1 bg-card [&>*]:[tap-highlight:transparent]"
    role="tablist"
  >
    <RouterLink
      v-for="tab in tabs"
      :key="tab.name"
      v-slot="{ isActive, navigate }"
      :to="tab.to"
      custom
    >
      <Button
        class="flex flex-1 press-scale flex-col gap-0.5 items-center justify-center h-full"
        :class="isActive ? 'text-primary' : 'text-muted-foreground'"
        variant="ghost"
        role="tab"
        :aria-selected="isActive"
        :aria-label="$t(tab.labelKey)"
        @click="navigate"
      >
        <component
          :is="isActive ? tab.activeIcon : tab.icon"
          class="size-6"
        />
        <span class="text-[10px] font-medium leading-none">{{ $t(tab.labelKey) }}</span>
      </Button>
    </RouterLink>

    <!-- <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          class="flex flex-1 press-scale flex-col gap-0.5 items-center justify-center h-full text-muted-foreground"
          variant="ghost"
          :aria-label="$t('nav.add')"
        >
          <IconPlus class="size-6" />
          <span class="text-[10px] font-medium leading-none">{{ $t('nav.add') }}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        :side-offset="12"
      >
        <DropdownMenuItem @click="createPlaylist">
          <IconPlaylistAdd class="size-6" />
          <span class=" text-lg">
            {{ $t('track.contextMenu.createPlaylist') }}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu> -->
  </nav>
</template>

<script setup lang="ts">
import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";
import IconHome from "~icons/tabler/home";
import IconHomeFilled from "~icons/tabler/home-filled";
import IconSearch from "~icons/tabler/search";
import IconLibrary from "~icons/tabler/books";
import IconSettings from "~icons/tabler/settings";
import IconSettingsFilled from "~icons/tabler/settings-filled";
import IconPlus from "~icons/tabler/plus";
import IconPlaylistAdd from "~icons/tabler/playlist-add";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLibrary } from "@/modules/library/composables/useLibrary";

const {

  createPlaylist,
} = useLibrary();

interface TabItem {
  name: string;
  to: RouteLocationRaw;
  labelKey: string;
  icon: Component;
  activeIcon: Component;
}

const tabs: TabItem[] = [
  {
    name: "home",
    to: "/",
    labelKey: "nav.home",
    icon: IconHome,
    activeIcon: IconHomeFilled,
  },

  {
    name: "library",
    to: "/library",
    labelKey: "nav.library",
    icon: IconLibrary,
    activeIcon: IconLibrary,
  },
  {
    name: "settings",
    to: "/settings",
    labelKey: "nav.settings",
    icon: IconSettings,
    activeIcon: IconSettingsFilled,
  },
];

</script>
