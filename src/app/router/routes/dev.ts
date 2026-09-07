import type { RouteRecordRaw } from "vue-router";
import { ROUTE_NAMES } from "@/app/router/route-names";

export const devRoutes: RouteRecordRaw[] = [
  {
    path: "/dev/reco",
    name: ROUTE_NAMES.DEV_RECO_STAND,
    component: () => import("@/pages/dev/RecoStandPage.vue"),
    meta: {
      title: "Стенд рекомендаций",
      depth: 2,
    },
  },
];
