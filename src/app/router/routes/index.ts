import { RouteRecordRaw } from "vue-router";
import { homeRoutes } from "./home";
import { profileRoutes } from "./profile";
import { settingsRoutes } from "./settings";
import { albumRoutes } from "./album";
import { artistRoutes } from "./artist";
import { playlistRoutes } from "./playlist";
import { favoriteRoutes } from "./favorite";

export const routes: RouteRecordRaw[] = [
  ...homeRoutes,
  ...settingsRoutes,
  ...profileRoutes,
  ...albumRoutes,
  ...artistRoutes,
  ...playlistRoutes,
  ...favoriteRoutes,
];

export {
  homeRoutes,
  profileRoutes,
  settingsRoutes,
  playlistRoutes,
  artistRoutes,
  albumRoutes,
  favoriteRoutes,
};
