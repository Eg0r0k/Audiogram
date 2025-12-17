<template>
  <DropdownMenu :modal="false">
    <DropdownMenuTrigger as-child>
      <Button variant="ghost">
        <Icon
          class="size-5"
          :icon="currentOption.icon"
        />
        {{ $t(`${currentOption.label}`) }}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      side="bottom"
      align="end"
    >
      <DropdownMenuLabel class="text-xs">
        {{ $t('media.display.label') }}
      </DropdownMenuLabel>
      <DropdownMenuItem
        v-for="option in viewOptions"
        :key="option.value"
        :class="{ 'text-primary!': viewMode === option.value }"
        @click="viewMode = option.value"
      >
        <Icon
          class="size-5"
          :icon="option.icon"
        />
        {{ $t(`${option.label}`) }}
        <Icon
          v-if="viewMode === option.value"
          class="size-4 ml-auto"
          icon="tabler:check"
        />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Icon } from "@iconify/vue";
import { useLibraryView, viewOptions } from "@/composables/useLibraryView";

const { viewMode, currentOption } = useLibraryView();
</script>
