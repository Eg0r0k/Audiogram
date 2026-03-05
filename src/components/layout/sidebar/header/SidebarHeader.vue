<template>
  <div class="flex items-center gap-3 shrink-0 px-4 pb-4">
    <div>
      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button
            variant="ghost"
            size="icon-lg"
            class="rounded-full"
          >
            <IconMenu2 class="size-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class=" w-52 bg-background/50"
          align="start"
        >
          <DropdownMenuGroup>
            <DropdownMenuItem
              @click="goSettings"
            >
              <IconFavorite class=" size-5" />  Favorite
            </DropdownMenuItem>
            <DropdownMenuItem
              @click="handleThemeToggle"
            >
              <component
                :is="themeIcon"
                class=" size-5"
              /> Change Theme
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem
              @click="goSettings"
            >
              <IconSettings class=" size-5" />  Settings
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <InputGroup class="dark:bg-background! bg-muted! border-none! rounded-full h-10">
      <InputGroupAddon
        tabindex="-1"
      >
        <IconSearch class="ml-1 size-5" />
      </InputGroupAddon>
      <InputGroupInput
        v-model="searchQuery"
        class="pl-4!"
        :placeholder="$t('common.search')"
        @keydown.stop
      />

      <InputGroupAddon
        v-if="searchQuery.trim()"
        tabindex="-1"
        align="inline-end"
      >
        <Button
          class="rounded-full"
          variant="ghost-primary"
          size="icon-sm"
          @click="clear"
        >
          <IconX class="size-5" />
        </Button>
      </InputGroupAddon>
    </InputGroup>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import IconMenu2 from "~icons/tabler/menu-2";
import IconFavorite from "~icons/tabler/bookmark";

import IconSearch from "~icons/tabler/search";
import IconX from "~icons/tabler/x";
import IconSun from "~icons/tabler/sun";
import IconMoon from "~icons/tabler/moon";
import IconSettings from "~icons/tabler/settings";

import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import { computed, ref } from "vue";
import DropdownMenu from "@/components/ui/dropdown-menu/DropdownMenu.vue";
import DropdownMenuTrigger from "@/components/ui/dropdown-menu/DropdownMenuTrigger.vue";
import DropdownMenuContent from "@/components/ui/dropdown-menu/DropdownMenuContent.vue";
import DropdownMenuGroup from "@/components/ui/dropdown-menu/DropdownMenuGroup.vue";
import DropdownMenuItem from "@/components/ui/dropdown-menu/DropdownMenuItem.vue";
import { useTheme } from "@/modules/settings/composables/useTheme";
import DropdownMenuSeparator from "@/components/ui/dropdown-menu/DropdownMenuSeparator.vue";
import router from "@/app/router";

const searchQuery = ref("");
const clear = () => {
  searchQuery.value = "";
};

const goSettings = () => {
  router.push("/settings");
};

const theme = useTheme();
const themeIcon = computed(() => (theme.isDark.value ? IconSun : IconMoon));
const handleThemeToggle = (event: MouseEvent) => {
  theme.toggleTheme(event);
};

</script>
