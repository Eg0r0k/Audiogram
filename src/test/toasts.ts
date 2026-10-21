import { vi } from "vitest";
import { toaster } from "@/app/toaster";
import type { ToastInput } from "@/components/ui/toast";

/**
 * Toasts the app toaster was asked to show, oldest first, optionally of one
 * colour. Only meaningful with the toaster mocked:
 * `vi.mock("@/app/toaster", () => ({ toaster: { add: vi.fn() } }))`.
 */
export const shownToasts = (color?: ToastInput["color"]): ToastInput[] =>
  vi.mocked(toaster.add).mock.calls
    .map(([toast]) => toast)
    .filter(toast => color === undefined || toast.color === color);

export const resetShownToasts = (): void => {
  vi.mocked(toaster.add).mockClear();
};
