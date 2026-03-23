<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button class="absolute bottom-4 right-4 size-12 rounded-full ">
        <IconPlus class="size-6" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      :side-offset="10"
      class="bg-background/30"
      align="end"
      side="top"
    >
      <DropdownMenuGroup>
        <DropdownMenuItem>
          Add Track
        </DropdownMenuItem>
        <DropdownMenuItem>
          <IconPlaylist class="size-5.5" />
          {{ $t('track.contextMenu.createPlaylist') }}
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import IconPlus from "~icons/tabler/plus";
import IconPlaylist from "~icons/tabler/playlist";

</script>
