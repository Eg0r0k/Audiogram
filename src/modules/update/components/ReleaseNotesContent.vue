<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";

interface Props {
  markdown: string;
}

const props = defineProps<Props>();

const renderedMarkdown = computed(
  () => marked.parse(props.markdown, {
    breaks: true,
    gfm: true,
  }) as string,
);
</script>

<template>
  <div
    class="release-notes-markdown"
    v-html="renderedMarkdown"
  />
</template>
