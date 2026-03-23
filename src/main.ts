import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import router from "./app/router";
import vRipple from "./directives/ripple";
import "./style.css";
import { i18n } from "@/app/i18n";
import App from "@/app/App.vue";
import { IS_TAURI } from "./lib/environment/userAgent";
import { vCopy } from "./directives/copy";

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

const app = createApp(App);

app.use(router);
app.use(pinia);
app.use(i18n);
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 min
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  },
});

// TODO: Fix restore player with set with queue, becouse this stop repitting without queue store.

if ("serviceWorker" in navigator && !IS_TAURI) {
  navigator.serviceWorker.register("/opfs-sw.js").catch(console.error);
}

app.directive("ripple", vRipple);
app.directive("copy", vCopy);

app.mount("#app");
