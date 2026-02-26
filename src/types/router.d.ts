import "vue-router";
declare module "vue-router" {
  interface RouteMeta {
    title?: string;
    titleKey?: string;
    layout?: "default" | "mobile" | "blank";
    icon?: string;
    // TODO: Implement that
    keepAlive?: boolean;
    depth?: number;
  }
}
