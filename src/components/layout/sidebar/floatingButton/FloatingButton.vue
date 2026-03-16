<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button class="absolute bottom-4 right-4 size-12 rounded-full ">
        <IconPlus class="size-6" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      :side-offset="10"
      class="bg-background/50"
      align="end"
      side="top"
    >
      <DropdownMenuGroup>
        <DropdownMenuItem>
          Add Track
        </DropdownMenuItem>
        <DropdownMenuItem>
          Add Playlist
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import IconPlus from "~icons/tabler/plus";

</script>
