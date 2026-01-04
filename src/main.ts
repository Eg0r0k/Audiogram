import { createApp } from "vue";
import { createPinia } from "pinia";
import { VueQueryPlugin } from "@tanstack/vue-query";
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";
import App from "./App.vue";
import router from "./router";
import { i18n } from "./i18n";
import vRipple from "./directives/ripple";
import "./style.css";

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

app.directive("ripple", vRipple);
app.mount("#app");
