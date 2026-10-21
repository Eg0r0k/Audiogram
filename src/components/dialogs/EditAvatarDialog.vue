<template>
  <DialogContent class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>{{ $t("dialogs.editAvatar.title") }}</DialogTitle>
    </DialogHeader>

    <div class="h-[400px] w-full rounded-md overflow-hidden relative">
      <template v-if="currentImageSrc">
        <vue-cropper
          ref="cropperRef"
          :src="currentImageSrc"
          :aspect-ratio="1"
          :view-mode="1"
          drag-mode="move"
          :background="false"
          :auto-crop-area="1"
          class="h-full w-full"
          @ready="isReady = true"
        />
      </template>
      <div
        v-else
        class="flex h-full w-full items-center justify-center bg-muted text-muted-foreground"
      >
        <div class="text-center">
          <IconPhoto class="mx-auto size-12 mb-2" />
          <p>{{ $t("dialogs.editAvatar.noImage") }}</p>
        </div>
      </div>
    </div>

    <InlineError v-if="errorMessage">
      {{ errorMessage }}
    </InlineError>
    <DialogFooter>
      <Button
        variant="ghost"
        color="destructive"
        :disabled="isSaving"
        @click="dismiss"
      >
        {{ $t("common.cancel") }}
      </Button>
      <Button
        variant="ghost"
        class="sm:mr-auto"
        :disabled="isSaving"
        @click="handleSelectFile"
      >
        {{ currentImageSrc ? $t("common.change") : $t("common.select") }}
      </Button>

      <Button
        v-if="currentImageSrc"
        variant="ghost"

        :disabled="isSaving || !isReady"
        @click="handleSave"
      >
        <Spinner
          v-if="isSaving"
          class="mr-2 size-4"
        />
        {{ $t("common.save") }}
      </Button>
    </DialogFooter>
  </DialogContent>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, h, onUnmounted, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";
import type Cropper from "cropperjs";

import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialogContext,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import InlineError from "@/components/common/InlineError.vue";
import { Spinner } from "@/components/ui/spinner";
import IconPhoto from "~icons/tabler/photo";
import { requestFiles } from "@/lib/files/requestFiles";
import { IMAGE_MIME_TYPES } from "@/types/media";
import { isValidImageFile } from "@/lib/environment/mimeSupport";
import { formatBytes } from "@/lib/format/memory";
import { getLogger } from "@/lib/logger";

const { t } = useI18n();

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_FILE_SIZE_MB = MAX_FILE_SIZE_BYTES / (1024 * 1024);
interface VueCropperComponent {
  cropper: Cropper;
  replace: (url: string) => void;
  getCroppedCanvas: (options?: Cropper.GetCroppedCanvasOptions) => HTMLCanvasElement | null;
  getData: (rounded?: boolean) => Cropper.Data;
  getContainerData: () => Cropper.ContainerData;
  getImageData: () => Cropper.ImageData;
  getCanvasData: () => Cropper.CanvasData;
  getCropBoxData: () => Cropper.CropBoxData;
  reset: () => void;
  clear: () => void;
  destroy: () => void;
}

interface FileSelectionError extends Error {
  message: string;
}

function isFileSelectionError(error: unknown): error is FileSelectionError {
  return error instanceof Error;
}

function isUserCancellation(error: FileSelectionError): boolean {
  return error.message === "CANCELLED" || error.message === "NO_FILE_SELECTED";
}

const VueCropper = defineAsyncComponent({
  loader: async () => {
    await import("cropperjs/dist/cropper.css");
    return import("vue-cropperjs");
  },
  loadingComponent: () => h(
    "div",
    { class: "flex h-full w-full items-center justify-center text-muted-foreground" },
    h(Spinner, { class: "size-8" }),
  ),
  delay: 200,
});

// Summoned fresh per crop: `imageSrc` is the picked file, the result is the
// cropped blob. Errors about a file re-picked in here stay in here.
const props = defineProps<{
  imageSrc: string;
}>();

const { close, dismiss } = useDialogContext<Blob>();
const errorMessage = ref<string | null>(null);

const cropperRef = useTemplateRef<VueCropperComponent>("cropperRef");

const localImageSrc = ref<string | null>(null);
const isReady = ref(false);
const isSaving = ref(false);
const currentMimeType = ref<string>("image/jpeg");

const currentImageSrc = computed(() => localImageSrc.value ?? props.imageSrc);

const acceptString = Object.values(IMAGE_MIME_TYPES).join(",");

const showError = (message: string): void => {
  errorMessage.value = message;
};

const handleSelectFile = async (): Promise<void> => {
  errorMessage.value = null;
  const filesResult = await requestFiles({
    accept: acceptString,
    multiple: false,
  }).catch((error: unknown) => {
    if (isFileSelectionError(error) && !isUserCancellation(error)) {
      getLogger().error(`[EditAvatar] File selection failed: ${String(error)}`);
      showError(t("dialogs.editAvatar.errors.loadFailed"));
    }
    return null;
  });

  if (!filesResult?.length) return;

  const file = filesResult[0];

  if (!isValidImageFile(file.name, file.type)) {
    showError(t("dialogs.editAvatar.errors.invalidFormat"));
    return;
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    showError(t("dialogs.editAvatar.errors.fileTooLarge", {
      maxSize: MAX_FILE_SIZE_MB,
      fileSize: formatBytes(file.size),
    }));
    return;
  }

  isReady.value = false;
  currentMimeType.value = file.type || "image/jpeg";

  const reader = new FileReader();

  reader.onload = (e: ProgressEvent<FileReader>): void => {
    const result = e.target?.result;

    if (typeof result !== "string") return;

    localImageSrc.value = result;

    if (cropperRef.value) {
      cropperRef.value.replace(result);
    }
  };

  reader.onerror = (): void => {
    showError(t("dialogs.editAvatar.errors.readFailed"));
  };

  reader.readAsDataURL(file);
};

const handleSave = (): void => {
  if (!cropperRef.value) return;

  isSaving.value = true;

  const canvas = cropperRef.value.getCroppedCanvas({
    width: 400,
    height: 400,
    fillColor: "#fff",
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high",
  });

  if (!canvas) {
    isSaving.value = false;
    showError(t("dialogs.editAvatar.errors.cropFailed"));
    return;
  }

  canvas.toBlob(
    (blob: Blob | null): void => {
      if (blob) {
        close(blob);
      }
      else {
        showError(t("dialogs.editAvatar.errors.createFailed"));
      }
      isSaving.value = false;
    },
    currentMimeType.value,
    0.9,
  );
};

onUnmounted(() => {
  if (localImageSrc.value?.startsWith("blob:")) {
    URL.revokeObjectURL(localImageSrc.value);
  }
});
</script>
