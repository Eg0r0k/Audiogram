import { render } from "@testing-library/vue";
import type { Component } from "vue";
import { createI18n } from "vue-i18n";
import { messages } from "@/app/i18n/messages";
import { closeAllDialogs, createDialogs, DialogHost, type DialogHandle, openDialog } from "@/components/ui/dialog";

/** The app's DialogHost with the dialog service installed; dialogs opened from code render into document.body. */
export const renderDialogHost = () => render(DialogHost, {
  global: {
    plugins: [createI18n({ legacy: false, locale: "en", messages }), createDialogs()],
    // The suite-wide teleport stub swallows the dialog portal.
    stubs: { teleport: false },
  },
});

/** Opens a dialog component and settles with its value, or `undefined` when dismissed, as summonDialog does. */
export const openForResult = <T>(component: Component, props: object = {}): Promise<T | undefined> =>
  (openDialog<T>(component, props as never) as DialogHandle<T>).then(result => (result.ok ? result.value : undefined));

/** Closes every open dialog and waits out the exit animation. */
export const closeDialogs = async (): Promise<void> => {
  closeAllDialogs();
  await new Promise(resolve => setTimeout(resolve, 350));
};
