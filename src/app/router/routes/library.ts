import { RouteRecordRaw } from "vue-router";

export const libraryRoutes: RouteRecordRaw[] = [
  {
    path: "/library",
    name: "library",
    component: () => import("@/pages/library/LibraryPage.vue"),
    meta: {
      titleKey: "nav.library",
    },
    children: [],
  },
];
