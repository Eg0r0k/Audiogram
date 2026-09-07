import { summonComponent, type SummonDialogOptions } from "./summon";
import { DIALOGS, type DialogKey, type DialogMap } from "./registry";

/**
 * `await summonDialog("deleteTracks", { count })` — the imperative dialog
 * entry point. Props and the result type come from {@link DialogMap};
 * `undefined` means dismissed. Stacking and the dedupe `key` behave as in
 * {@link summonComponent}.
 */
export const summonDialog = <K extends DialogKey>(
  key: K,
  props: DialogMap[K]["props"],
  options: SummonDialogOptions = {},
): Promise<DialogMap[K]["result"] | undefined> =>
  summonComponent<DialogMap[K]["result"]>(DIALOGS[key], props, options);
