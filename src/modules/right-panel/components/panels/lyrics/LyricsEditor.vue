<template>
  <div
    class="relative flex min-h-0 flex-1 flex-col px-5 pt-2 pb-[calc(1rem+var(--keyboard-inset,0px)+var(--mobile-bottom-inset,0px))]"
    :style="keyboardInsetStyle"
  >
    <Textarea
      v-model="text"
      variant="soft"
      class="h-full min-h-0 flex-1 resize-none text-sm"
      :placeholder="mode === 'write' ? $t('lyrics.editor.placeholder') : undefined"
      :aria-label="$t('lyrics.title')"
      :disabled="isPending"
    />
    <p class="mt-3 flex h-12 shrink-0 items-center pr-14 text-xs text-muted-foreground">
      {{ formatLine }}
    </p>

    <FloatingActionButton :show="dirty">
      <Button
        type="button"
        class="size-12 rounded-full shadow-lg"
        :aria-label="$t('lyrics.save')"
        :disabled="isPending || !dirty"
        @click="save"
      >
        <IconSave class="size-6" />
      </Button>
    </FloatingActionButton>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import FloatingActionButton from "@/components/common/FloatingActionButton.vue";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useKeyboardInset } from "@/composables/useKeyboardInset";
import { useLyricsActions } from "@/modules/player/composables/useLyricsActions";
import { hasLyricsText, parseLyrics } from "@/modules/player/lib/lrc";
import type { Track } from "@/modules/player/types";
import IconSave from "~icons/tabler/device-floppy";

const props = defineProps<{
  track: Track;
  mode: "edit" | "write";
  dirty: boolean;
}>();

const emit = defineEmits<{
  saved: [];
}>();

const text = defineModel<string>({ required: true });

const { t } = useI18n();
const { saveText, isPending } = useLyricsActions();
const { keyboardInset } = useKeyboardInset();
const keyboardInsetStyle = computed(() => ({ "--keyboard-inset": `${keyboardInset.value}px` }));

const formatLine = computed(() => {
  const parsed = parseLyrics(text.value);
  if (!hasLyricsText(parsed)) return "";
  if (parsed.kind === "plain") return t("lyrics.editor.plain");
  return t("lyrics.editor.synced", parsed.lines.filter(line => line.text !== "").length);
});

const save = async () => {
  if (!props.dirty || isPending.value) return;
  const saved = await saveText(props.track, text.value, { resetOffset: props.mode === "write" }).catch(() => null);
  if (saved) emit("saved");
};
</script>
