import type { ComputedRef, InjectionKey } from "vue";

/**
 * Provided by ResizableSidebar so the library sidebar and its children switch
 * to the icon-only layout. Absent (defaults to false) when the sidebar is
 * rendered full-size, e.g. the mobile IndexPage.
 */
export const SIDEBAR_COMPACT_KEY: InjectionKey<ComputedRef<boolean>>
  = Symbol("sidebar-compact");
