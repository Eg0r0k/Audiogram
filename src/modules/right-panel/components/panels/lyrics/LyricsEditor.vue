<template>
  <div class="flex min-h-0 flex-1 flex-col pb-[calc(1rem+var(--keyboard-inset,0px)+var(--mobile-bottom-inset,0px))]">
    <Scrollable
      ref="scrollArea"
      class="min-h-0 flex-1"
    >
      <div class="flex min-h-full flex-col px-5 pt-2">
        <Textarea
          v-model="text"
          variant="soft"
          autoresize
          class="grow resize-none text-sm"
          :placeholder="mode === 'write' ? $t('lyrics.editor.placeholder') : undefined"
          :aria-label="$t('lyrics.title')"
          :disabled="isPending"
          @input="scheduleCaretReveal"
        />
      </div>
    </Scrollable>
    <p class="mt-3 flex h-12 shrink-0 items-center pr-19 pl-5 text-xs text-muted-foreground">
      {{ formatLine }}
    </p>
  </div>

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
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import FloatingActionButton from "@/components/common/FloatingActionButton.vue";
import { Button } from "@/components/ui/button";
import { Scrollable } from "@/components/ui/scrollable";
import { Textarea } from "@/components/ui/textarea";
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
const scrollArea = useTemplateRef<InstanceType<typeof Scrollable>>("scrollArea");

const formatLine = computed(() => {
  const parsed = parseLyrics(text.value);
  if (!hasLyricsText(parsed)) return "";
  if (parsed.kind === "plain") return t("lyrics.editor.plain");
  return t("lyrics.editor.synced", parsed.lines.filter(line => line.text !== "").length);
});

const caretBottom = (field: HTMLTextAreaElement) => {
  const end = field.selectionEnd;
  const mirror = field.cloneNode() as HTMLTextAreaElement;
  mirror.removeAttribute("id");
  mirror.setAttribute("aria-hidden", "true");
  mirror.tabIndex = -1;
  mirror.value = field.value.slice(0, end + field.value.slice(end).search(/\s|$/));
  Object.assign(mirror.style, {
    position: "absolute",
    width: getComputedStyle(field).width,
    height: "0",
    minHeight: "0",
    visibility: "hidden",
    pointerEvents: "none",
  });
  field.after(mirror);
  const bottom = field.clientTop + mirror.scrollHeight;
  mirror.remove();
  return bottom;
};

const revealCaret = (field: HTMLTextAreaElement) => {
  const area = scrollArea.value;
  const container = area?.container;
  if (!area || !container) return;
  const fieldTop = field.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  const below = fieldTop + caretBottom(field) - container.scrollTop - container.clientHeight;
  if (below > 0) area.scrollTo({ position: container.scrollTop + below, behavior: "instant" });
};

// Autoresize grows the field after the browser has scrolled to the caret, which can leave it below the view.
let revealFrame: number | null = null;
const scheduleCaretReveal = (event: Event) => {
  const field = event.target;
  if (!(field instanceof HTMLTextAreaElement) || revealFrame !== null) return;
  revealFrame = requestAnimationFrame(() => {
    revealFrame = null;
    revealCaret(field);
  });
};
onBeforeUnmount(() => {
  if (revealFrame !== null) cancelAnimationFrame(revealFrame);
});

const save = async () => {
  if (!props.dirty || isPending.value) return;
  const saved = await saveText(props.track, text.value, { resetOffset: props.mode === "write" }).catch(() => null);
  if (saved) emit("saved");
};
</script>
