<template>
  <Dialog

    :open="isOpen"
    @update:open="val => !isRunning && !val && handleClose()"
  >
    <DialogContent class="flex flex-col max-h-[80vh] sm:max-w-2xl gap-0 p-0 overflow-hidden h-full">
      <div class="px-6 pt-5 pb-4">
        <div class="flex items-start justify-between gap-4">
          <div class="flex flex-col gap-1">
            <DialogTitle class="text-base font-semibold leading-none">
              <template v-if="isRunning">
                Импорт треков...
              </template>
              <template v-else-if="successCount > 0">
                Импорт завершён
              </template>
              <template v-else>
                Импорт не удался
              </template>
            </DialogTitle>

            <p
              v-if="isRunning"
              class="text-sm text-muted-foreground"
            >
              {{ current }} из {{ total }} файлов
            </p>
            <p
              v-if="files.length < total"
              class="text-xs text-muted-foreground"
            >
              Показаны только первые {{ visibleFileCount }} файлов из {{ total }}
            </p>
            <p
              v-else
              class="text-sm text-muted-foreground flex items-center gap-2"
            >
              <span
                v-if="successCount > 0"
                class="text-primary"
              >
                +{{ successCount }} добавлено
              </span>
              <span
                v-if="skippedCount > 0"
                class="text-muted-foreground"
              >
                · {{ skippedCount }} пропущено
              </span>
              <span
                v-if="errorCount > 0"
                class="text-destructive"
              >
                · {{ errorCount }} ошибок
              </span>
            </p>
          </div>

          <div class="relative size-10 shrink-0">
            <svg
              class="size-10 -rotate-90"
              viewBox="0 0 36 36"
            >
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                class="text-muted/30"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                class="text-primary transition-all duration-300"
                :stroke-dasharray="`${2 * Math.PI * 15}`"
                :stroke-dashoffset="`${2 * Math.PI * 15 * (1 - progress / 100)}`"
              />
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums">
              {{ progress }}%
            </span>
          </div>
        </div>
      </div>

      <Separator />

      <Scrollable>
        <div class="flex flex-col p-2">
          <Item
            v-for="file in files"
            :key="file.name"
            size="sm"
          >
            <ItemMedia>
              <IconLoader2
                v-if="file.status === 'pending'"
                class="size-5 shrink-0 animate-spin"
              />
              <IconCheck
                v-else-if="file.status === 'ok'"
                class="size-5 shrink-0 text-primary"
              />
              <IconMinus
                v-else-if="file.status === 'skipped'"
                class="size-5 shrink-0"
              />
              <IconAlertCircle
                v-else
                class="size-5 shrink-0"
              />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                {{ file.name }}
              </ItemTitle>
              <ItemDescription v-if="file.error">
                {{ file.error }}
              </ItemDescription>
            </ItemContent>
          </Item>
        </div>
      </Scrollable>

      <Separator />
      <div class="px-4 py-3 flex gap-2">
        <Button
          v-if="!isRunning"
          variant="destructive-link"
          :class="successCount > 0 ? '' : 'flex-1'"
          @click="handleClose"
        >
          Закрыть
        </Button>
        <Button
          v-if="!isRunning && successCount > 0"
          class="flex-1"
          variant="ghost-primary"
          @click="goToLibrary"
        >
          Перейти в библиотеку
        </Button>

        <Button
          v-if="isRunning"
          variant="ghost-primary"
          disabled
          class="flex-1"
        >
          <IconLoader2 class="size-3.5 mr-2 animate-spin" />
          Идёт импорт...
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useImport } from "@/composables/useImport";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import IconCheck from "~icons/tabler/check";
import IconMinus from "~icons/tabler/minus";
import IconLoader2 from "~icons/tabler/loader-2";
import IconAlertCircle from "~icons/tabler/alert-circle";

const router = useRouter();
const {
  isOpen,
  isRunning,
  progress,
  files,
  total,
  current,
  visibleFileCount,
  successCount,
  errorCount,
  skippedCount,
  closeSheet,
  reset,
} = useImport();

function handleClose() {
  closeSheet();
  reset();
}

function goToLibrary() {
  closeSheet();
  reset();
  router.push("/library");
}
</script>
