import { useBreakpoints } from "@vueuse/core";
import { computed } from "vue";

const breakpoints = useBreakpoints({ tablet: 1024 });

export type LayoutType = "desktop" | "mobile";

const isMobileLayout = breakpoints.smaller("tablet");
const isDesktopLayout = computed(() => !isMobileLayout.value);
const layoutType = computed<LayoutType>(() => (isMobileLayout.value ? "mobile" : "desktop"));

export const useDeviceLayout = () => ({ layoutType, isMobileLayout, isDesktopLayout }) as const;
