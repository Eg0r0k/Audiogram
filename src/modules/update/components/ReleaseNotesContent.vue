<script setup lang="ts">
import { onMounted, useTemplateRef, watch } from "vue";
import { useI18n } from "vue-i18n";
import photoOffRaw from "~icons/tabler/photo-off?raw";

const props = defineProps<{
  html: string;
}>();

const { t } = useI18n();
const root = useTemplateRef<HTMLElement>("root");

const markFailed = (image: HTMLImageElement) => {
  const media = image.closest(".rn-media");
  if (!(media instanceof HTMLElement) || media.hasAttribute("data-failed")) return;

  const label = document.createElement("span");
  label.className = "rn-failed";
  label.innerHTML = photoOffRaw;
  label.firstElementChild?.setAttribute("aria-hidden", "true");
  label.append(t("update.imageFailed"));

  media.setAttribute("data-failed", "");
  media.append(label);
};

const handleError = (event: Event) => {
  if (event.target instanceof HTMLImageElement) markFailed(event.target);
};

const markAlreadyFailed = () => {
  root.value?.querySelectorAll<HTMLImageElement>(".rn-media > img").forEach((image) => {
    if (image.complete && image.naturalWidth === 0) markFailed(image);
  });
};

onMounted(markAlreadyFailed);
watch(() => props.html, markAlreadyFailed, { flush: "post" });
</script>

<template>
  <div
    ref="root"
    class="release-notes-markdown"
    @error.capture="handleError"
    v-html="html"
  />
</template>
