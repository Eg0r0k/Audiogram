<template>
  <PanelTextEditor
    :model-value="textValue"
    field-class="font-mono leading-relaxed tabular-nums"
    :placeholder="t('chapters.editorPlaceholder')"
    :label="t('chapters.editorPlaceholder')"
    show-save
    :save-label="t('chapters.save')"
    :save-disabled="saveDisabled"
    @update:model-value="onText"
    @keydown.tab.prevent="onTab"
    @save="emit('save')"
  >
    <template #status>
      <span
        v-if="parseError"
        class="line-clamp-2 text-destructive"
      >{{ parseError }}</span>
      <template v-else>
        <span>{{ t("chapters.count", chapters.length) }}</span>
        <span
          v-if="totalDuration"
          class="ml-auto tabular-nums"
        >{{ formatDuration(totalDuration) }}</span>
      </template>
    </template>
  </PanelTextEditor>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { array, check, pipe, regex, safeParse, string } from "valibot";
import PanelTextEditor from "@/components/common/PanelTextEditor.vue";
import { formatDuration } from "@/lib/format/time";

export interface DraftChapter {
  id: string;
  time: number;
  title: string;
}

const props = defineProps<{
  modelValue: DraftChapter[];
  duration: number;
  saveDisabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", chapters: DraftChapter[]): void;
  (e: "save"): void;
}>();

const { t } = useI18n();

const textValue = ref("");
const internalUpdate = ref(false);

function chaptersToText(chapters: DraftChapter[]): string {
  return chapters
    .map((c) => {
      const m = Math.floor(c.time / 60);
      const s = Math.round(c.time % 60);
      const time = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
      return `${time} - ${c.title || t("chapters.untitled")}`;
    })
    .join("\n");
}

watch(() => props.modelValue, (val) => {
  if (internalUpdate.value) {
    internalUpdate.value = false;
    return;
  }
  const current = chaptersToText(val);
  if (current !== textValue.value) {
    textValue.value = current;
  }
}, { deep: true, immediate: true });

// `[H:]MM:SS`, then a space or a dash, then the title. The lookahead demands
// the separator up front so the greedy `\s*` never has to backtrack into it
// (the previous `(?:\s*[-–]\s*|\s+)` alternation was super-linear).
const linePattern = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?=[\s\-–])\s*(?:[-–]\s*)?(\S.*)$/;

/** Seconds encoded by a line that matches `linePattern`. */
function timeOf(line: string): number {
  const match = linePattern.exec(line);
  if (!match) return Number.NaN;
  const hours = match[1] ? Number(match[1]) : 0;
  return hours * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function parseLine(line: string): { time: number; title: string } | null {
  const match = linePattern.exec(line);
  if (!match) return null;
  const time = timeOf(line);
  if (time > props.duration) return null;
  return { time, title: match[4].trim() };
}

// Non-empty lines, trimmed — what both the validator and the parser see.
const lines = computed(() => textValue.value.split("\n").map(line => line.trim()).filter(Boolean));

// One rule per line: it must have the `[H:]MM:SS title` shape, and its
// timestamp must fall inside the track. The first offending line is the
// message; issues carry the input, so the message can quote it.
const linesSchema = computed(() => array(pipe(
  string(),
  regex(linePattern, issue => t("chapters.lineUnrecognized", { line: issue.input })),
  check(
    line => timeOf(line) <= props.duration,
    issue => t("chapters.lineBeyondDuration", { line: issue.input, duration: formatDuration(props.duration) }),
  ),
)));

const parseError = computed<string | null>(() => {
  const result = safeParse(linesSchema.value, lines.value);
  return result.success ? null : result.issues[0].message;
});

const parsed = computed(() => {
  const result: { time: number; title: string }[] = [];
  for (const line of lines.value) {
    const entry = parseLine(line);
    if (entry) result.push(entry);
  }
  return result.sort((a, b) => a.time - b.time);
});

const chapters = computed(() =>
  parsed.value.map(c => ({ id: crypto.randomUUID(), time: c.time, title: c.title })),
);

const totalDuration = computed(() => {
  if (parsed.value.length === 0) return 0;
  return parsed.value[parsed.value.length - 1].time;
});

function syncParent(): void {
  internalUpdate.value = true;
  emit("update:modelValue", chapters.value);
}

const onText = (value: string): void => {
  textValue.value = value;
  syncParent();
};

function onTab(event: KeyboardEvent): void {
  const ta = event.target;
  if (!(ta instanceof HTMLTextAreaElement)) return;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  textValue.value = textValue.value.slice(0, start) + "  " + textValue.value.slice(end);
  syncParent();
  requestAnimationFrame(() => {
    ta.selectionStart = ta.selectionEnd = start + 2;
  });
}
</script>
