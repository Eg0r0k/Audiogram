<template>
  <DropdownMenu :modal="false">
    <DropdownMenuTrigger as-child>
      <Button
        class="absolute bottom-4 right-4 size-12 rounded-full "
      >
        <IconPlus class="size-6" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      :side-offset="10"
      class="bg-popover/50 backdrop-blur-[50px]"
      align="end"
      side="top"
    >
      <DropdownMenuGroup>
        <DropdownMenuItem @click="handleImportTracks">
          <IconImport class="size-5.5" />
          {{ $t("import.button") }}
        </DropdownMenuItem>
        <DropdownMenuItem @click="createPlaylist">
          <IconPlaylist class="size-5.5" />
          {{ $t("track.contextMenu.createPlaylist") }}
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import IconPlus from "~icons/tabler/plus";
import IconImport from "~icons/tabler/file-import";
import IconPlaylist from "~icons/tabler/playlist";
import { useLibrary } from "@/modules/library/composables/useLibrary";
import { requestFiles } from "@/lib/files/requestFiles";
import { useImport } from "@/composables/useImport";

const { createPlaylist } = useLibrary();
const { importFiles } = useImport();

const ACCEPTED_EXTENSIONS = [".mp3", ".flac", ".wav", ".ogg", ".m4a", ".aac", ".opus"];

async function handleImportTracks() {
  const files = await requestFiles({
    accept: ACCEPTED_EXTENSIONS.join(","),
    multiple: true,
  });
  if (files.length > 0) {
    await importFiles(files);
  }
}
</script>
