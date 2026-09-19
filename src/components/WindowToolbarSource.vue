<template>
  <div
    class="titlebar-center"
    data-tauri-drag-region
  >
    <Link
      v-if="sourceLink?.to"
      :to="sourceLink.to"
      class="titlebar-source"
    >
      {{ sourceLink.label }}
    </Link>
    <span
      v-else-if="sourceLink"
      class="titlebar-source titlebar-source-static"
    >
      {{ sourceLink.label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { Link } from "@/components/ui/link";
import { useQueueSourceLink } from "@/modules/queue/composables/useQueueSourceLink";

const { link: sourceLink } = useQueueSourceLink();
</script>

<style scoped>
.titlebar-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  max-width: min(40%, 320px);
    pointer-events: none;
}

.titlebar-source {
  pointer-events: auto;
  -webkit-app-region: no-drag;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--muted-foreground);
  text-decoration: none;
  transition: background-color 0.15s ease, color 0.15s ease;
}

a.titlebar-source:hover {
  background: color-mix(in oklab, var(--accent), var(--foreground) 10%);
  color: var(--foreground);
}

a.titlebar-source:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: -2px;
}

.titlebar-source-static {
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .titlebar-source {
    transition: none;
  }
}
</style>
