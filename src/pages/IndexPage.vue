<script setup lang="ts">
import { ref, computed } from "vue";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import Updatedevpanel from "@/app/Updatedevpanel.vue";

/* ── Config ──────────────────────────────────────────────────────── */
// Пустая строка = same origin (работает с Vite proxy)
// Или, например, "http://localhost:3000"
const API = import.meta.env.VITE_API_URL ?? "";

/* ── Types ───────────────────────────────────────────────────────── */
interface UploadedTrack {
  id: string;
  segments: number;
  stream_url: string; // /api/v1/test/hls/<id>/master.m3u8
  filename: string;
}

/* ── State ───────────────────────────────────────────────────────── */
const inputRef = ref<HTMLInputElement | null>(null);
const fileName = ref("");
const uploading = ref(false);
const errMsg = ref("");

const tracks = ref<UploadedTrack[]>([]);
const active = ref<UploadedTrack | null>(null);

const pState = ref("idle");

const playing = computed(
  () => pState.value === "playing" || pState.value === "buffering",
);

/* ── Upload ──────────────────────────────────────────────────────── */
function onFileSelect() {
  fileName.value = inputRef.value?.files?.[0]?.name ?? "";
}

async function upload() {
  const file = inputRef.value?.files?.[0];
  if (!file) {
    errMsg.value = "Сначала выберите файл";
    return;
  }

  uploading.value = true;
  errMsg.value = "";

  const fd = new FormData();
  fd.append("file", file);

  try {
    const r = await fetch(`${API}/api/v1/test/upload`, {
      method: "POST",
      body: fd,
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${r.status}`);
    }
    const data = await r.json();
    tracks.value.unshift({ ...data, filename: file.name });
    fileName.value = "";
    if (inputRef.value) inputRef.value.value = "";
  }
  catch (e: any) {
    errMsg.value = e.message;
  }
  finally {
    uploading.value = false;
  }
}

</script>

<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <Updatedevpanel />

    <div class="px-6 py-8 max-w-3xl mx-auto space-y-8">
      <div
        v-if="errMsg"
        class="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive flex items-center justify-between"
      >
        <span>{{ errMsg }}</span>
        <button
          class="text-xs underline ml-4 shrink-0"
          @click="errMsg = ''"
        >
          закрыть
        </button>
      </div>

      <!-- Загрузка файла -->
      <section class="space-y-3">
        <h2 class="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Загрузка
        </h2>
        <div class="flex items-center gap-3">
          <label
            class="flex-1 flex items-center justify-center rounded-lg border-2 border-dashed
                   border-muted-foreground/25 hover:border-primary/50 px-4 py-5
                   cursor-pointer transition-colors text-sm text-muted-foreground"
          >
            {{ fileName || "Выберите аудиофайл (.mp3, .flac, .wav, .ogg …)" }}
            <input
              ref="inputRef"
              type="file"
              class="sr-only"
              accept=".mp3,.flac,.wav,.ogg,.m4a,.aac,.opus"
              @change="onFileSelect"
            >
          </label>
          <button
            :disabled="uploading || !fileName"
            class="shrink-0 rounded-lg bg-primary text-primary-foreground px-5 py-2.5
                   text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            @click="upload"
          >
            {{ uploading ? "Обработка…" : "Загрузить" }}
          </button>
        </div>
      </section>

      <Separator v-if="tracks.length > 0" />

      <section
        v-if="tracks.length > 0"
        class="space-y-3"
      >
        <h2 class="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Загруженные треки
        </h2>
        <div class="space-y-1">
          <div
            v-for="(t, i) in tracks"
            :key="t.id"
            class="flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors"
            :class="active?.id === t.id ? 'bg-primary/10' : 'hover:bg-muted/50'"
            @click="playTrack(t)"
          >
            <span class="w-5 text-center text-sm font-mono text-muted-foreground shrink-0">
              {{ i + 1 }}
            </span>

            <span class="size-8 rounded bg-muted flex items-center justify-center shrink-0">
              <svg
                v-if="active?.id === t.id && playing"
                xmlns="http://www.w3.org/2000/svg"
                class="size-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect
                  x="6"
                  y="4"
                  width="4"
                  height="16"
                  rx="1"
                />
                <rect
                  x="14"
                  y="4"
                  width="4"
                  height="16"
                  rx="1"
                />
              </svg>
              <svg
                v-else
                xmlns="http://www.w3.org/2000/svg"
                class="size-4 ml-0.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>

            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate">
                {{ t.filename }}
              </p>
              <p class="text-xs text-muted-foreground font-mono truncate">
                {{ t.id }}
              </p>
            </div>

            <Badge
              variant="secondary"
              class="shrink-0 tabular-nums"
            >
              {{ t.segments }} seg
            </Badge>
          </div>
        </div>
      </section>

      <div
        v-if="!tracks.length && !active"
        class="text-center py-12 text-muted-foreground text-sm"
      >
        Загрузите аудиофайл, чтобы начать
      </div>
    </div>
  </Scrollable>
</template>
