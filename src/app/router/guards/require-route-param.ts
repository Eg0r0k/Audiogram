import type { NavigationGuardWithThis } from "vue-router";
import { routeLocation } from "@/app/router/route-locations";

function hasRouteParamValue(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.some(item => item.trim().length > 0);
  }

  return false;
}

export const requireRouteParam = (paramName: string): NavigationGuardWithThis<undefined> => {
  return (to) => {
    const paramValue = to.params[paramName];

    if (hasRouteParamValue(paramValue)) {
      return true;
    }

    return routeLocation.home();
  };
};
