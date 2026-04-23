<template>
  <Motion
    :initial="{ opacity: 0, scale: 0.5, y: 100 }"
    :animate="{
      opacity: show ? 1 : 0,
      scale: show ? 1 : 0.7,
      y: show ? 0 : 80,
      pointerEvents: show ? 'auto' : 'none'
    }"
    :transition="{
      type: 'spring',
      stiffness: 300,
      damping: 25
    }"
    class="absolute bottom-4 right-4 z-50"
  >
    <DropdownMenu :modal="false">
      <DropdownMenuTrigger as-child>
        <Button
          class="size-12 rounded-full shadow-lg"
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
  </Motion>
</template>

<script setup lang="ts">
import { Motion } from "motion-v";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import IconPlus from "~icons/tabler/plus";
import IconImport from "~icons/tabler/file-import";
import IconPlaylist from "~icons/tabler/playlist";
import { useLibrary } from "@/modules/library/composables/useLibrary";
import { requestFiles } from "@/lib/files/requestFiles";
import { useImport } from "@/composables/useImport";

defineProps<{
  show: boolean;
}>();

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
