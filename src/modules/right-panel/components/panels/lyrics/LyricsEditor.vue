<template>
  <PanelTextEditor
    v-model="text"
    :placeholder="mode === 'write' ? $t('lyrics.editor.placeholder') : undefined"
    :label="$t('lyrics.title')"
    :disabled="isPending"
    :show-save="dirty"
    :save-label="$t('lyrics.save')"
    :save-disabled="isPending || !dirty"
    @save="save"
  >
    <template #status>
      {{ formatLine }}
    </template>
  </PanelTextEditor>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import PanelTextEditor from "@/components/common/PanelTextEditor.vue";
import { useLyricsActions } from "@/modules/player/composables/useLyricsActions";
import { hasLyricsText, parseLyrics } from "@/modules/player/lib/lrc";
import type { Track } from "@/modules/player/types";

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
