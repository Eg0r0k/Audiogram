<!-- eslint-disable vuejs-accessibility/label-has-for -->
<template>
  <DialogContent class="w-full max-w-[95vw] sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>{{ title }}</DialogTitle>
    </DialogHeader>

    <form
      class="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-6"
      @submit.prevent="onSubmit"
    >
      <div class="flex relative flex-col gap-2">
        <button
          type="button"
          class="group relative cursor-pointer size-48 overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          :class="{ 'border-destructive': imageError }"
          :disabled="isSaving"
          @click="handleSelectCover"
        >
          <img
            v-if="cover.previewUrl.value"
            :src="cover.previewUrl.value"
            :alt="coverAlt"
            class="size-full object-cover"
          >
          <div
            v-else
            class="flex size-full items-center justify-center bg-muted"
          >
            <IconPhoto class="size-6 sm:size-8 text-muted-foreground" />
          </div>

          <Button
            v-if="cover.previewUrl.value"
            class="absolute top-2 right-2 rounded-full shadow-shadow-md"
            variant="solid"
            color="destructive"
            size="icon-sm"
            :disabled="isSaving"
            @click.stop="handleRemoveCover"
          >
            <IconTrash class="size-4" />
          </Button>
        </button>
        <InlineError
          v-if="imageError"
          class="max-w-48"
        >
          {{ imageError }}
        </InlineError>
      </div>

      <div class="flex flex-col gap-4 min-w-0">
        <div class="space-y-2">
          <InputFloating
            :id="primaryField.id"
            v-model="primary"
            variant="soft"
            :label="primaryField.label"
            :placeholder="primaryField.placeholder"
            :disabled="isSaving"
            :aria-invalid="!!errors.primary || undefined"
            @keydown.enter.prevent="onSubmit"
          />

          <p
            v-if="errors.primary"
            class="text-sm text-destructive"
          >
            {{ errors.primary }}
          </p>
        </div>

        <div class="space-y-2">
          <Label
            :for="secondaryField.id"
            :class="{ 'text-destructive': errors.secondary }"
          >
            {{ secondaryField.label }}
          </Label>

          <Textarea
            :id="secondaryField.id"
            v-model="secondary"
            variant="soft"
            :placeholder="secondaryField.placeholder"
            :disabled="isSaving"
            :aria-invalid="!!errors.secondary || undefined"
          />

          <p
            v-if="errors.secondary"
            class="text-sm text-destructive"
          >
            {{ errors.secondary }}
          </p>
        </div>
      </div>
    </form>

    <InlineError v-if="saveFailed">
      {{ $t("common.saveChangesFailed") }}
    </InlineError>
    <DialogFooter class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button
        variant="ghost"
        class="w-full sm:w-auto"
        :disabled="isSaving"
        @click="dismiss"
      >
        {{ $t("common.cancel") }}
      </Button>

      <Button
        variant="ghost"
        class="w-full sm:w-auto"
        :disabled="isSaving || !meta.valid || !hasChanges"
        @click="onSubmit"
      >
        {{ saveFailed ? $t("common.retry") : $t("common.save") }}
      </Button>
    </DialogFooter>
  </DialogContent>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useForm } from "vee-validate";
import type { InferOutput } from "valibot";
import { maxLength, minLength, object, optional, pipe, string } from "valibot";
import { toTypedSchema } from "@vee-validate/valibot";

import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  useDialogContext,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputFloating } from "@/components/ui/input-floating";
import { Label } from "@/components/ui/label";
import InlineError from "@/components/common/InlineError.vue";
import { Textarea } from "@/components/ui/textarea";
import { summonDialog } from "@/components/dialogs/summonDialog";
import { useCoverImageField, type CoverSelectionErrorType } from "@/composables/useCoverImageField";
import type { EditEntityDialogProps, EditEntityFieldConfig } from "./editEntityDialog";

import IconPhoto from "~icons/tabler/photo";
import IconTrash from "~icons/tabler/trash";

// Summoned fresh per edit; `save` runs in here so the form stays open
// (locked) while it works and keeps the user's input if it fails.
const props = defineProps<EditEntityDialogProps>();

const { close, dismiss, loading: isSaving } = useDialogContext<true>();

const buildSchema = (primary: EditEntityFieldConfig, secondary: EditEntityFieldConfig) => object({
  primary: pipe(
    string(),
    minLength(1, primary.requiredMessage ?? ""),
    maxLength(primary.maxLength, primary.maxLengthMessage),
  ),
  secondary: optional(pipe(
    string(),
    maxLength(secondary.maxLength, secondary.maxLengthMessage),
  )),
});
type EntityFormValues = InferOutput<ReturnType<typeof buildSchema>>;

const entityFormSchema = computed(() => toTypedSchema(buildSchema(props.primaryField, props.secondaryField)));

const { errors, meta, defineField, handleSubmit, resetForm, setValues } = useForm<EntityFormValues>({
  validationSchema: entityFormSchema,
  initialValues: { primary: "", secondary: "" },
});

const [primary] = defineField("primary");
const [secondary] = defineField("secondary");

const cover = useCoverImageField();

const imageError = ref<string | null>(null);
const saveFailed = ref(false);

const hasChanges = computed((): boolean => {
  const primaryChanged = primary.value.trim() !== props.initialPrimary;
  const secondaryChanged = (secondary.value?.trim() ?? "") !== props.initialSecondary;

  return primaryChanged || secondaryChanged || cover.hasChanged.value;
});

function resetFormState(): void {
  resetForm();
  cover.reset();
  isSaving.value = false;
  imageError.value = null;
}

function initializeForm(): void {
  resetFormState();
  setValues({ primary: props.initialPrimary, secondary: props.initialSecondary });
  cover.originalCoverUrl.value = props.currentCoverUrl ?? null;
}

function coverErrorMessage(type: CoverSelectionErrorType): string {
  switch (type) {
    case "INVALID_FORMAT":
      return props.coverErrorMessages.invalidFormat;
    case "READ_ERROR":
      return props.coverErrorMessages.readError;
    default:
      return props.coverErrorMessages.unknown;
  }
}

async function handleSelectCover(): Promise<void> {
  imageError.value = null;

  const result = await cover.selectFile();

  await result.match(
    async (dataUrl) => {
      const blob = await summonDialog("editAvatar", { imageSrc: dataUrl }, { key: "edit-avatar" });
      if (!blob) return;
      cover.applyCropped(blob);
      imageError.value = null;
    },
    (type) => {
      if (type !== "CANCELLED") imageError.value = coverErrorMessage(type);
    },
  );
}

function handleRemoveCover(): void {
  cover.remove();
  imageError.value = null;
}

const onSubmit = handleSubmit(async (values) => {
  if (!hasChanges.value || isSaving.value) return;

  isSaving.value = true;
  saveFailed.value = false;
  try {
    await props.save({
      primary: values.primary,
      secondary: values.secondary ?? "",
      cover: cover.getChange(),
    });
    close(true);
  }
  catch {
    // Keep the form and its input for another try; the caller logged why.
    saveFailed.value = true;
    isSaving.value = false;
  }
});

initializeForm();
onBeforeUnmount(() => cover.cleanupBlobUrls());
</script>
