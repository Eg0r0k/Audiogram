<!-- eslint-disable vuejs-accessibility/label-has-for -->
<template>
  <Dialog
    :open="open"
    @update:open="value => emit('update:open', value)"
  >
    <DialogContent class="w-full max-w-[95vw] sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>

      <Alert
        v-if="imageError"
        variant="destructive"
        class="py-2"
      >
        <IconAlertCircle class="size-4" />
        <AlertTitle>{{ imageError }}</AlertTitle>
      </Alert>

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
              class="absolute top-2 right-2"
              variant="destructive-link"
              size="icon-sm"
              :disabled="isSaving"
              @click.stop="handleRemoveCover"
            >
              <IconTrash class="size-4" />
            </Button>
          </button>
        </div>

        <div class="flex flex-col gap-4 min-w-0">
          <div class="space-y-2">
            <Label
              :for="primaryField.id"
              :class="{ 'text-destructive': errors.primary }"
            >
              {{ primaryField.label }}
            </Label>

            <Input
              :id="primaryField.id"
              v-model="primary"
              :placeholder="primaryField.placeholder"
              :disabled="isSaving"
              :class="{ 'border-destructive focus-visible:ring-destructive': errors.primary }"
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
              :placeholder="secondaryField.placeholder"
              :disabled="isSaving"
              :class="{ 'border-destructive focus-visible:ring-destructive': errors.secondary }"
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

      <DialogFooter class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="destructive-link"
          class="w-full sm:w-auto"
          :disabled="isSaving"
          @click="dismiss"
        >
          {{ $t("common.cancel") }}
        </Button>

        <Button
          variant="link"
          class="w-full sm:w-auto"
          :disabled="isSaving || !meta.valid || !hasChanges"
          @click="onSubmit"
        >
          {{ $t("common.save") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { useForm } from "vee-validate";
import type { InferOutput } from "valibot";
import { maxLength, minLength, object, optional, pipe, string } from "valibot";
import { toTypedSchema } from "@vee-validate/valibot";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { summonDialog } from "@/components/dialogs/summonDialog";
import { useSummonedDialog } from "@/components/dialogs/summon";
import { useCoverImageField, type CoverSelectionErrorType } from "@/composables/useCoverImageField";
import type { EditEntityDialogProps, EditEntityFieldConfig } from "./editEntityDialog";

import IconPhoto from "~icons/tabler/photo";
import IconTrash from "~icons/tabler/trash";
import IconAlertCircle from "~icons/tabler/alert-circle";

// Summoned fresh per edit; `save` runs in here so the form stays open
// (locked) while it works and keeps the user's input if it fails.
const props = defineProps<EditEntityDialogProps & { open: boolean }>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const { resolve, dismiss } = useSummonedDialog<true>();

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

const isSaving = ref(false);
const imageError = ref<string | null>(null);

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
  try {
    await props.save({
      primary: values.primary,
      secondary: values.secondary ?? "",
      cover: cover.getChange(),
    });
    resolve(true);
  }
  catch {
    // The caller reported the failure; keep the form and its input.
    isSaving.value = false;
  }
});

initializeForm();
onBeforeUnmount(() => cover.cleanupBlobUrls());
</script>
