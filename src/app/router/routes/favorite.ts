import { RouteRecordRaw } from "vue-router";

export const favoriteRoutes: RouteRecordRaw[] = [
  {
    path: "/liked",
    name: "liked",
    component: () => import("@/pages/FavoritePage.vue"),
  },
];
