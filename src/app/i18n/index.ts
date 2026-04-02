import { createI18n } from "vue-i18n";
import { messages } from "./messages";
import { DEFAULT_LOCALE, getInitialLocale } from "./utils";

export const i18n = createI18n({
  legacy: false,
  messages,
  locale: getInitialLocale(),
  fallbackFormat: DEFAULT_LOCALE,
  pluralRules: {
    ru: (choice: number) => {
      if (choice === 0) return 0;
      const teen = choice > 10 && choice < 20;
      const endsWithOne = choice % 10 === 1;
      if (!teen && endsWithOne) return 1;
      const endsWithTwoToFour = choice % 10 >= 2 && choice % 10 <= 4;
      if (!teen && endsWithTwoToFour) return 2;
      return 3;
    },
  },
});
