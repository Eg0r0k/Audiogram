import type { RouteRecordRaw } from "vue-router";
import { ROUTE_NAMES } from "@/app/router/route-names";

export const devRoutes: RouteRecordRaw[] = [
  {
    path: "/dev/mascot",
    name: ROUTE_NAMES.DEV_MASCOT_STAND,
    component: () => import("@/pages/dev/MascotStandPage.vue"),
    meta: {
      title: "Маскоты-заглушки",
      depth: 2,
    },
  },
];
