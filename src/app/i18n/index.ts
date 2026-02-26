import { createI18n } from "vue-i18n";
import { messages } from "./messages";
import { DEFAULT_LOCALE, getInitialLocale } from "./utils";

export const i18n = createI18n({
  legacy: false,
  messages,
  locale: getInitialLocale(),
  fallbackFormat: DEFAULT_LOCALE,
});
