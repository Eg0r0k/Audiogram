<template>
  <Dialog
    :open="open"
    @update:open="value => emit('update:open', value)"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>

      <div class="flex flex-col gap-4 h-full">
        <div class="flex flex-col gap-1.5">
          <Input
            :id="fieldId"
            v-model="name"
            surface="card"
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
            variant="destructive-link"
            @click="dismiss"
          >
            {{ $t("common.cancel") }}
          </Button>
          <Button
            type="button"
            variant="ghost-primary"
            :disabled="!meta.valid"
            @click="onSubmit"
          >
            {{ $t("common.save") }}
          </Button>
        </DialogFooter>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { useId } from "vue";
import { useI18n } from "vue-i18n";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/valibot";
import { maxLength, minLength, object, pipe, string, transform } from "valibot";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSummonedDialog } from "@/components/dialogs/summon";
import { FOLDER_NAME_MAX_LENGTH, normalizeFolderName } from "@/modules/library/lib/folderName";

// Summoned fresh per use, so the field starts from `initialName` with no
// error left over from a previous attempt.
const props = defineProps<{
  open: boolean;
  /** What the field starts with: the current name on rename, a default on create. */
  initialName: string;
  title: string;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
}>();

const { resolve, dismiss } = useSummonedDialog<string>();

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

const { errors, meta, defineField, handleSubmit } = useForm({
  validationSchema: toTypedSchema(schema),
  initialValues: { name: props.initialName },
});

const [name] = defineField("name");

const onSubmit = handleSubmit((values) => {
  resolve(values.name);
});
</script>
