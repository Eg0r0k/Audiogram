import { type ToastInput, type Toasts, createToaster } from "@/components/ui/toast";

const manager = createToaster();

// duration 0 switches the timer off; close: true is then the way out besides an action.
const waitsForUser = (toast: ToastInput): boolean =>
  toast.color === "destructive" || (toast.actions?.length ?? 0) > 0;

/** The app's one toast service: installed in main.ts, callable from services and stores alike. */
export const toaster: Toasts = {
  ...manager,
  add: toast => manager.add(waitsForUser(toast) ? { ...toast, duration: 0, close: true } : toast),
};
