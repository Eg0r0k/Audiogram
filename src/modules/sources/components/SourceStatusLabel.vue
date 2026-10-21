<template>
  <span class="inline-flex min-w-0 items-center gap-1.5">
    <span
      class="size-2 shrink-0 rounded-full"
      :class="dotClass"
      aria-hidden="true"
    />
    <span class="min-w-0 wrap-break-word">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { sources } from "@/modules/sources";
import { sourceHealth } from "@/modules/sources/lib/health";
import type { SourceKind } from "@/types/track-ref";

const props = defineProps<{
  kind: SourceKind;
}>();

const { t } = useI18n();

const status = computed(() => {
  if (!sources.isAvailable(props.kind)) return { tone: "idle", label: t("source.status.notConfigured") } as const;
  const health = sourceHealth(props.kind);
  switch (health.state) {
    case "checking": return { tone: "idle", label: t("source.status.checking") } as const;
    case "ok": return { tone: "ok", label: t("source.status.ok") } as const;
    // The source's own words say what to fix; the generic line is the fallback.
    case "failed": return { tone: "failed", label: health.error.message || t("source.status.failed") } as const;
    default: return { tone: "idle", label: t("source.status.available") } as const;
  }
});

const label = computed(() => status.value.label);

const dotClass = computed(() => {
  switch (status.value.tone) {
    case "ok": return "bg-primary";
    case "failed": return "bg-destructive";
    default: return "bg-muted-foreground/50";
  }
});
</script>
