import { ref } from "vue";

export const APP_NAME = "Audiogram";
export const routeTitle = ref(APP_NAME);

import type { RouteLocationNormalized } from "vue-router";

export const getDocumentTitle = (to: Pick<RouteLocationNormalized, "meta">) => to.meta.title
  ? `${to.meta.title} | ${APP_NAME}`
  : APP_NAME;

export const titleMiddleware = (to: RouteLocationNormalized) => {
  routeTitle.value = getDocumentTitle(to);
};
