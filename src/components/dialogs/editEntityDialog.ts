import type { CoverImageChange } from "@/composables/useCoverImageField";

export interface EditEntityFieldConfig {
  id: string;
  label: string;
  placeholder: string;
  maxLength: number;
  maxLengthMessage: string;
  /** Required-field message; used for the primary field only. */
  requiredMessage?: string;
}

export interface EditEntityCoverErrorMessages {
  invalidFormat: string;
  readError: string;
  unknown: string;
}

export interface EditEntitySubmitPayload {
  primary: string;
  secondary: string;
  cover: CoverImageChange;
}

/** What `summonDialog("editEntity", …)` takes; `save` runs inside the dialog. */
export interface EditEntityDialogProps {
  title: string;
  coverAlt: string;
  currentCoverUrl?: string | null;
  primaryField: EditEntityFieldConfig;
  secondaryField: EditEntityFieldConfig;
  initialPrimary: string;
  initialSecondary: string;
  coverErrorMessages: EditEntityCoverErrorMessages;
  save: (payload: EditEntitySubmitPayload) => Promise<void>;
}
