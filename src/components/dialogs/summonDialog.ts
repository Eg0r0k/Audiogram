import { type DialogHandle, openDialog } from "@/components/ui/dialog";
import { DIALOGS, type DialogKey, type DialogMap } from "./registry";

export interface SummonDialogOptions {
  /** Dedupe key: while a dialog with this key is open, re-summoning it
   *  returns the existing promise instead of stacking a duplicate. */
  key?: string;
}

const openByKey = new Map<string, Promise<unknown>>();

/**
 * `await summonDialog("resetSettings", {})` — the imperative dialog
 * entry point. Props and the result type come from {@link DialogMap};
 * `undefined` means dismissed.
 */
export const summonDialog = <K extends DialogKey>(
  key: K,
  props: DialogMap[K]["props"],
  options: SummonDialogOptions = {},
): Promise<DialogMap[K]["result"] | undefined> => {
  type Result = DialogMap[K]["result"];
  const existing = options.key ? openByKey.get(options.key) : undefined;
  if (existing) return existing as Promise<Result | undefined>;

  const dedupeKey = options.key;
  const handle = openDialog<Result>(DIALOGS[key], props) as DialogHandle<Result>;
  const promise = handle.then((result) => {
    if (dedupeKey) openByKey.delete(dedupeKey);
    return result.ok ? result.value : undefined;
  });
  if (dedupeKey) openByKey.set(dedupeKey, promise);
  return promise;
};
