import type { RouteRecordRaw } from "vue-router";

export const settingsRoutes: RouteRecordRaw[] = [
  {
    path: "/settings",
    name: "settings",
    component: () => import("@/pages/settings/SettingsPage.vue"),
    meta: {
      titleKey: "nav.settings",
      depth: 3,
    },
  },
  {
    path: "/settings/general",
    name: "settings-general",
    component: () => import("@/pages/settings/GeneralSettings.vue"),
    meta: {
      titleKey: "settings.general",
      depth: 4,
    },
  },
  {
    path: "/settings/audio",
    name: "settings-audio",
    component: () => import("@/pages/settings/AudioSettings.vue"),
    meta: {
      titleKey: "settings.audio",
      depth: 4,
    },
  },
  {
    path: "/settings/storage",
    name: "settings-storage",
    component: () => import("@/pages/settings/StorageSettings.vue"),
    meta: {
      titleKey: "settings.storage",
      depth: 4,
    },
  },
  {
    path: "/settings/language",
    name: "settings-language",
    component: () => import("@/pages/settings/LanguageSettings.vue"),
    meta: {
      titleKey: "settings.language",
      depth: 4,
    },
  },
  {
    path: "/settings/notifications",
    name: "settings-notifications",
    component: () => import("@/pages/settings/NotificationsSettings.vue"),
    meta: {
      titleKey: "settings.notifications",
      depth: 4,
    },
  },
  {
    path: "/settings/appearance",
    name: "settings-appearance",
    component: () => import("@/pages/settings/AppearanceSettings.vue"),
    meta: {
      titleKey: "settings.appearance",
      depth: 4,
    },
  },
  {
    path: "/settings/about",
    name: "settings-about",
    component: () => import("@/pages/settings/AboutSettings.vue"),
    meta: {
      titleKey: "settings.about",
      depth: 4,
    },
  },
];
