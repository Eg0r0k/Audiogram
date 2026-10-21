<template>
  <DialogContent class="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>{{ title }}</DialogTitle>
    </DialogHeader>

    <div class="flex flex-col gap-4 h-full">
      <div class="flex flex-col gap-1.5">
        <InputFloating
          :id="fieldId"
          v-model="name"
          variant="soft"
          :label="$t('library.folder.namePlaceholder')"
          :maxlength="FOLDER_NAME_MAX_LENGTH"
          :aria-invalid="!!errors.name || undefined"
          :aria-describedby="errors.name ? errorId : undefined"
          :class="{ 'border-destructive focus-visible:ring-destructive': errors.name }"
          @keydown.enter.prevent="onSubmit"
        />
        <p
          v-if="errors.name"
          :id="errorId"
          class="text-xs text-destructive"
          role="alert"
        >
          {{ errors.name }}
        </p>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          @click="dismiss"
        >
          {{ $t("common.cancel") }}
        </Button>
        <Button
          type="button"
          variant="ghost"
          :disabled="!meta.valid"
          @click="onSubmit"
        >
          {{ $t("common.save") }}
        </Button>
      </DialogFooter>
    </div>
  </DialogContent>
</template>

<script setup lang="ts">
import { useId, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/valibot";
import { maxLength, minLength, object, pipe, string, transform } from "valibot";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogFooter, DialogHeader, DialogTitle, useDialogContext } from "@/components/ui/dialog";
import { InputFloating } from "@/components/ui/input-floating";
import { FOLDER_NAME_MAX_LENGTH, normalizeFolderName } from "@/modules/library/lib/folderName";

// Summoned fresh per use, so the field starts from `initialName` with no
// error left over from a previous attempt.
const props = defineProps<{
  /** What the field starts with: the current name on rename, a default on create. */
  initialName: string;
  title: string;
}>();

const { close, dismiss } = useDialogContext<string>();

const { t } = useI18n();
const fieldId = useId();
const errorId = useId();

// The rules themselves live in folderName.ts; this schema only adds the
// messages and normalizes before measuring, so "   " is empty and padding
// does not count toward the limit.
const schema = object({
  name: pipe(
    string(),
    transform(normalizeFolderName),
    minLength(1, t("library.folder.validation.nameRequired")),
    maxLength(FOLDER_NAME_MAX_LENGTH, t("library.folder.validation.nameMaxLength", { max: FOLDER_NAME_MAX_LENGTH })),
  ),
});

const { errors, meta, defineField, handleSubmit, resetForm } = useForm({
  validationSchema: toTypedSchema(schema),
});
watch(() => props.initialName, (name) => {
  resetForm({ values: { name } });
}, { immediate: true });

const [name] = defineField("name");

const onSubmit = handleSubmit((values) => {
  close(values.name);
});
</script>
