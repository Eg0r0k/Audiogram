<template>
  <div
    class="shrink-0 flex items-center pb-3 border-b dark:border-background border-border"
    :class="compact ? 'justify-center px-2' : 'gap-2 px-4'"
  >
    <Button
      variant="ghost"
      color="muted"
      size="icon-lg"
      class="rounded-full"

      @click="emit('close')"
    >
      <IconArrowLeft class="size-6" />
    </Button>

    <div
      v-if="!compact"
      class="min-w-0 flex-1"
    >
      <Editable
        :model-value="folder.name"
        :max-length="FOLDER_NAME_MAX_LENGTH"
        activation-mode="dblclick"
        submit-mode="both"
        select-on-focus
        class="max-w-full text-lg font-bold"
        :title="$t('common.editHint')"
        @submit="rename"
      >
        <EditableArea class="min-w-0">
          <EditablePreview class="truncate" />
          <EditableInput :aria-label="$t('common.editLabel')" />
        </EditableArea>
      </Editable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Editable, EditableArea, EditableInput, EditablePreview } from "@/components/ui/editable";
import type { SidebarFolderEntity } from "@/db/entities";
import { FOLDER_NAME_MAX_LENGTH, validateFolderName } from "@/modules/library/lib/folderName";
import IconArrowLeft from "~icons/tabler/arrow-left";
import type { Nullish } from "@/types/utils";

const props = defineProps<{
  folder: SidebarFolderEntity;
  compact?: boolean;
}>();

const emit = defineEmits<{
  close: [];
  rename: [name: string];
}>();

// The value stays bound to the stored name, so a rejected one reverts on its own.
const rename = (value: Nullish<string>) => {
  const name = value?.trim() ?? "";
  if (name === props.folder.name || validateFolderName(name) !== null) return;
  emit("rename", name);
};
</script>
