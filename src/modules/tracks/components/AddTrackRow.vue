<template>
  <div class="add-track-row-container mx-auto max-w-page">
    <div
      v-ripple
      role="button"
      tabindex="0"
      :aria-label="$t('track.addTracks')"
      class="add-track-row group h-14 w-full cursor-pointer select-none items-center rounded-md border-2 border-dashed border-border px-[10px] outline-none transition-colors hover:border-foreground/40 hover:bg-muted/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      @click="emit('add')"
      @keydown.enter="emit('add')"
    >
      <div class="index-col flex items-center justify-center text-muted-foreground transition-colors group-hover:text-foreground">
        <IconPlus class="size-5" />
      </div>
      <div class="first-col flex min-w-0 items-center gap-3">
        <IconPlus class="narrow-plus size-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
        <span class="truncate text-sm font-medium text-foreground">{{ $t("track.addTracks") }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import IconPlus from "~icons/tabler/plus";


const emit = defineEmits<{
  add: [];
}>();
</script>

<style scoped>
.add-track-row-container {
  container-type: inline-size;
}

.add-track-row {
  display: grid;
  grid-template-columns: var(--grid-template-columns);
  gap: 12px;
}

.index-col { grid-column: index; }
.first-col { grid-column: first; }

.narrow-plus { display: none; }

@container (max-width: 900px) {
  .add-track-row {
    --grid-template-columns: var(--grid-template-columns-medium) !important;
  }
}

@container (max-width: 620px) {
  .add-track-row {
    --grid-template-columns: var(--grid-template-columns-small) !important;
    gap: 8px;
  }
  .index-col { display: none; }
  .narrow-plus { display: block; }
}
</style>
