import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import router from "./app/router";
import vRipple from "./directives/ripple";
import "./style.css";
import { i18n } from "@/app/i18n";
import App from "@/app/App.vue";
import { installReducedMotion } from "@/app/reduced-motion";
import { platformCaps } from "./lib/environment/platformCaps";
import { vCopy } from "./directives/copy";
import { queryClient } from "@/queries/client";
import { getLogger, initLogging } from "./lib/logger";
import { initMediaServerBase } from "./lib/stream-url";
import { initPlayerLifecycle } from "@/modules/player/player-lifecycle";
import { initDownloadManager } from "@/modules/downloads/service/manager";
import { sweepOrphanedEntities } from "@/services/library-gc";
import { hideAndroidSplash } from "@/lib/android-splash";
import { initZoom } from "@/modules/settings/composables/useZoom";
import { statsService } from "@/services/stats.service";
import { invalidateStatsQueries } from "@/queries/stats.queries";
import { onAllDataCleared } from "@/services/storage-info.service";
import { resetSearchIndex } from "@/modules/search/service/searchIndex";
import { openDatabase } from "@/db";
import { sources } from "@/modules/sources/registry";
import { ytSourceProvider } from "@/modules/youtube/source-provider";
import { ymSourceProvider } from "@/modules/sources/yandex/provider";
import { registerAutoplaySource } from "@/modules/queue/lib/queue-autoplay";
import { getRecommendations } from "@/modules/recommendations/service/recommender.service";
import { markRecommenderContextDirty } from "@/modules/recommendations/service/recommender-context.service";
import { invalidateWeightsCache } from "@/modules/recommendations/service/recommender-model.service";

await initLogging();

// Media URL builders are synchronous over this cached base — it must exist
// before any store resolves playback or covers (incl. queue restore).
// No-op outside Tauri. The Rust server binds before the webview, so this
// cannot race server readiness.
await initMediaServerBase().catch(error =>
  getLogger().error(`[MediaServer] base init failed: ${String(error)}`),
);

// Open IndexedDB once, up front, so an upgrade/quota failure is classified
// and logged with its code instead of surfacing as an opaque error on the
// first query. Startup continues either way (Dexie auto-opens on use); the
// user-facing screen for a dead database is a separate follow-up.
const dbOpen = await openDatabase();
if (dbOpen.isErr()) {
  getLogger().error(`[DB] open failed (${dbOpen.error.code}): ${dbOpen.error.message}`);
}

// Feature → core registrations (ARCHITECTURE.md §3), before any store can
// ask the registry: persisted stores resolve sources on first use.
sources.register(ytSourceProvider);
sources.register(ymSourceProvider);
registerAutoplaySource(getRecommendations);
statsService.onChange(markRecommenderContextDirty);
statsService.onListenRecorded(markRecommenderContextDirty);

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

installReducedMotion();

const app = createApp(App);

if (!import.meta.env.DEV) {
  document.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
}

app.use(router);
app.use(pinia);
app.use(i18n);
app.use(VueQueryPlugin, { queryClient });

// Cross-store reactions to track lifecycle events (stats, queue advance,
// sleep-after-track) — registered once, ordered explicitly.
initPlayerLifecycle();

// Services stay below the query/search layers; their effects on those layers
// are wired here.
statsService.onChange(() => {
  invalidateStatsQueries(queryClient).catch(error =>
    getLogger().error(`[Stats] Refreshing stats queries failed: ${String(error)}`),
  );
});
onAllDataCleared(resetSearchIndex);
onAllDataCleared(markRecommenderContextDirty);
// The full wipe took the recommenderModels row too; the cached weights would
// otherwise keep the deleted model active until reload.
onAllDataCleared(invalidateWeightsCache);

// Download queue: requeue interrupted jobs, sweep temp orphans, resume.
// No-op outside Tauri. Failures must not block app startup.
initDownloadManager().catch(error =>
  getLogger().error(`[Downloads] Init failed: ${String(error)}`),
);

// One-off per launch: drop album/artist rows that lost their last track
// before the deletion cascade existed. Failures must not block startup.
sweepOrphanedEntities().catch(error =>
  getLogger().error(`[LibraryGC] Sweep failed: ${String(error)}`),
);

// Re-apply the persisted zoom; previously it only kicked in once the user
// visited a settings page.
initZoom();

// In production the OPFS handler is part of the workbox sw.js (registered by
// usePwaUpdate); vite-plugin-pwa builds no worker in dev, so only there the
// script is registered on its own.
if (import.meta.env.DEV && "serviceWorker" in navigator && !platformCaps.hasFs) {
  navigator.serviceWorker.register("/opfs-sw.js?standalone").catch(console.error);
}

app.directive("ripple", vRipple);
app.directive("copy", vCopy);

app.mount("#app");

router.isReady()
  .then(() => {
    requestAnimationFrame(() => requestAnimationFrame(hideAndroidSplash));
  })
  .catch(error => getLogger().error(`[Boot] Hiding the splash screen failed: ${String(error)}`));
