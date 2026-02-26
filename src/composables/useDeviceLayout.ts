import { IS_MOBILE, IS_TAURI } from "@/lib/environment/userAgent";

export type LayoutType = "desktop" | "mobile";

const layoutType: LayoutType = (IS_MOBILE && !IS_TAURI) ? "mobile" : "desktop";

export function useDeviceLayout() {
  const isMobileLayout = layoutType === "mobile";
  const isDesktopLayout = layoutType === "desktop";

  return {
    layoutType,
    isMobileLayout,
    isDesktopLayout,
  } as const;
}
