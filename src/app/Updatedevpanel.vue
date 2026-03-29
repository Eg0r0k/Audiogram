<script setup lang="ts">
import { IS_TAURI } from "@/lib/environment/userAgent";
import { useChangelogStore } from "@/modules/update/store/changelog.store";
import { useUpdateStore } from "@/modules/update/store/update.store";

const update = useUpdateStore();
const changelog = useChangelogStore();

const statusColors: Record<string, string> = {
  "idle": "text-neutral-400",
  "checking": "text-blue-400",
  "available": "text-violet-400",
  "up-to-date": "text-green-400",
  "downloading": "text-yellow-400",
  "installing": "text-orange-400",
  "error": "text-red-400",
};

function simulateWhatsNew() {
  changelog.setPendingChangelog(__APP_VERSION__, `## Что нового в ${__APP_VERSION__}
### ✨ Новые функции
- Система автоматических обновлений
- WhatsNew модал после обновления
- Поддержка каналов stable / beta

### 🐛 Исправления
- Исправлена утечка памяти при воспроизведении
- Улучшена производительность сканирования библиотеки

### 🔧 Технические изменения
- Обновлён Tauri до v2
- Переход на TanStack Query v5`);
}

const version = __APP_VERSION__;

</script>

<template>
  <div class="fixed bottom-4 left-4 z-[9999] w-72 rounded-xl border border-white/10 bg-neutral-950/95 p-4 font-mono text-xs backdrop-blur-sm shadow-2xl">
    <div class="mb-3 flex items-center justify-between">
      <span class="font-sans text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
        Update Dev Panel
      </span>
      <span
        class="rounded px-1.5 py-0.5 text-[10px] font-medium"
        :class="IS_TAURI ? 'bg-violet-500/20 text-violet-300' : 'bg-blue-500/20 text-blue-300'"
      >
        {{ IS_TAURI ? 'Tauri' : 'PWA' }}
      </span>
    </div>

    <div class="space-y-1.5 rounded-lg bg-white/5 p-3">
      <div class="flex justify-between">
        <span class="text-neutral-500">status</span>
        <span
          :class="statusColors[update.status] ?? 'text-white'"
          class="font-semibold"
        >
          {{ update.status }}
        </span>
      </div>
      <div class="flex justify-between">
        <span class="text-neutral-500">channel</span>
        <span class="text-white">{{ update.channel }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-neutral-500">current</span>
        <span class="text-white">{{ version }}</span>
      </div>
      <div
        v-if="update.updateInfo"
        class="flex justify-between"
      >
        <span class="text-neutral-500">available</span>
        <span class="text-violet-300">{{ update.updateInfo.version }}</span>
      </div>
      <div
        v-if="update.downloadPercent !== null"
        class="space-y-1"
      >
        <div class="flex justify-between">
          <span class="text-neutral-500">progress</span>
          <span class="text-yellow-300">{{ update.downloadPercent }}%</span>
        </div>
        <div class="h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div
            class="h-full rounded-full bg-violet-500 transition-all duration-300"
            :style="{ width: `${update.downloadPercent}%` }"
          />
        </div>
      </div>
      <div
        v-if="update.error"
        class="mt-1 rounded bg-red-500/10 p-1.5 text-red-400"
      >
        {{ update.error.kind }}: {{ update.error.message }}
      </div>
    </div>

    <!-- Changelog state -->
    <div class="mt-2 space-y-1 rounded-lg bg-white/5 p-3">
      <div class="flex justify-between">
        <span class="text-neutral-500">lastSeen</span>
        <span class="text-white">{{ changelog.lastSeenVersion || '—' }}</span>
      </div>
      <div class="flex justify-between">
        <span class="text-neutral-500">hasUnseen</span>
        <span :class="changelog.hasUnseenUpdate ? 'text-violet-300' : 'text-neutral-500'">
          {{ changelog.hasUnseenUpdate }}
        </span>
      </div>
      <div class="flex justify-between">
        <span class="text-neutral-500">pendingVer</span>
        <span class="text-white">{{ changelog.pendingVersion || '—' }}</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="mt-3 grid grid-cols-2 gap-1.5">
      <!-- Channel toggle -->
      <button
        class="col-span-2 rounded-lg bg-white/5 px-2 py-1.5 text-neutral-300 hover:bg-white/10 transition-colors"
        @click="update.setChannel(update.channel === 'stable' ? 'beta' : 'stable')"
      >
        → {{ update.channel === 'stable' ? 'beta' : 'stable' }}
      </button>

      <button
        class="rounded-lg bg-blue-500/20 px-2 py-1.5 text-blue-300 hover:bg-blue-500/30 transition-colors disabled:opacity-40"
        :disabled="update.isBusy"
        @click="update.check()"
      >
        check
      </button>

      <button
        class="rounded-lg bg-violet-500/20 px-2 py-1.5 text-violet-300 hover:bg-violet-500/30 transition-colors disabled:opacity-40"
        :disabled="update.status !== 'available'"
        @click="update.install()"
      >
        install
      </button>

      <button
        class="rounded-lg bg-white/5 px-2 py-1.5 text-neutral-400 hover:bg-white/10 transition-colors"
        @click="update.dismiss()"
      >
        dismiss
      </button>

      <button
        class="rounded-lg bg-green-500/20 px-2 py-1.5 text-green-300 hover:bg-green-500/30 transition-colors"
        @click="simulateWhatsNew()"
      >
        sim whats-new
      </button>

      <button
        class="col-span-2 rounded-lg bg-red-500/10 px-2 py-1.5 text-red-400 hover:bg-red-500/20 transition-colors"
        @click="changelog.markSeen()"
      >
        reset changelog seen
      </button>
    </div>
  </div>
</template>
