<template>
  <div class="flex flex-col gap-3 px-4 pt-4 pb-2">
    <div class="flex items-center justify-between">
      <h1 class="font-bold text-xl">
        {{ $t('library.title') }}
      </h1>
      <div class="flex gap-2">
        <InputGroup class="dark:bg-muted! bg-background rounded-full max-w-sm h-9">
          <InputGroupAddon
            tabindex="-1"
          >
            <IconSearch class="ml-1 size-5" />
          </InputGroupAddon>
          <InputGroupInput
            :model-value="searchQuery"
            class="pl-3! text-sm"
            :placeholder="$t('library.searchPlaceholder')"
            @update:model-value="$emit('search', ($event as string))"
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
              @click="$emit('search', '')"
            >
              <IconX class="size-4" />
            </Button>
          </InputGroupAddon>
        </InputGroup>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon-lg"
              class="rounded-full"
            >
              <IconPlus class="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            class=" w-55"
            align="end"
          >
            <DropdownMenuItem @click="$emit('createPlaylist')">
              <IconPlaylist class="size-4" />
              {{ $t('library.createPlaylist') }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@/components/ui/input-group";
import IconPlus from "~icons/tabler/plus";
import IconPlaylist from "~icons/tabler/playlist";
import IconSearch from "~icons/tabler/search";
import IconX from "~icons/tabler/x";

defineProps<{
  searchQuery: string;
}>();

defineEmits<{
  createPlaylist: [];
  search: [value: string];
}>();
</script>
