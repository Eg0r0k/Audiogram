import type { NavigationHookAfter } from "vue-router";
import { closeAllDialogs } from "@/components/ui/dialog";

// Dialogs survive navigation. A new page closes them; a query or hash change
// on the same page (a search box writing to the URL) leaves them open.
export const closeDialogsOnLeave: NavigationHookAfter = (to, from, failure) => {
  if (failure || to.path === from.path) return;
  closeAllDialogs();
};
