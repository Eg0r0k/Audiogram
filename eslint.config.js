import js from "@eslint/js";
import typescript from "typescript-eslint";
import vue from "eslint-plugin-vue";
import { withVueTs, vueTsConfigs } from "@vue/eslint-config-typescript";
import globals from "globals";
import vuejsAccessibility from "eslint-plugin-vuejs-accessibility";
import stylistic from "@stylistic/eslint-plugin";
import importX from "eslint-plugin-import-x";
import sonarjs from "eslint-plugin-sonarjs";

// ARCHITECTURE.md §3. A module is core once three or more modules need its
// domain code; everything else is a feature.
const CORE_MODULES = ["sources", "tracks", "queue", "player", "covers", "library", "settings", "downloads", "right-panel", "search"];
const FEATURE_MODULES = ["albums", "artists", "playlist", "favorite", "media-hero", "watched-folders", "update", "recommendations", "hotkeys", "youtube"];

// Files that still break M1/M2. This list only shrinks.
const KNOWN_LAYER_VIOLATIONS = [];

// Composed into `no-restricted-imports` below. Type imports stay free.
const BAN_INVOKE = { name: "@tauri-apps/api/core", importNames: ["invoke"], message: "M3: use invokeCommand(COMMANDS.x) from @/app/tauri-commands." };
const BAN_LISTEN = { name: "@tauri-apps/api/event", importNames: ["listen"], message: "M3: use listenEvent(EVENTS.x) from @/app/tauri-commands." };
const BAN_SUMMON_COMPONENT = { name: "@/components/dialogs/summon", importNames: ["summonComponent"], message: "Summon by key: summonDialog(key, props) from @/components/dialogs/summonDialog." };
const BAN_IS_TAURI = { group: ["**/environment/userAgent"], importNames: ["IS_TAURI"], message: "Gate on platformCaps.hasX (src/lib/environment/platformCaps.ts), not on IS_TAURI." };
const restrictImports = (paths, patterns) => ({ "no-restricted-imports": ["error", { paths, patterns }] });

export default withVueTs(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "src-tauri/**",
      // Stale git worktrees of old branches: a full copy of src/, which
      // tripled every report here.
      ".claude/**",
      "**/__tests__/**",
      "**/__test__/**",
      // Tests are exempt wherever they live — a co-located *.test.ts is the
      // same kind of file as one under __tests__/.
      "**/*.test.ts",
    ],
  },

  js.configs.recommended,
  ...vue.configs["flat/recommended"],
  vueTsConfigs.recommendedTypeChecked,
  ...vuejsAccessibility.configs["flat/recommended"],
  sonarjs.configs.recommended,

  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      // A written `default` is a deliberate "everything else" branch; without
      // this flag the rule demands every union member be spelled out anyway.
      "@typescript-eslint/switch-exhaustiveness-check": ["error", {
        considerDefaultExhaustiveForUnions: true,
      }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },

  {
    files: ["**/*.js", "src/test/**", "**/*.spec.ts"],
    extends: [typescript.configs.disableTypeChecked],
    languageOptions: {
      parserOptions: { projectService: false, project: false },
    },
  },

  stylistic.configs.customize({
    indent: 2,
    quotes: "double",
    semi: true,
    jsx: false,
  }),

  {
    languageOptions: {
      globals: {
        ...globals.browser,
        __APP_VERSION__: "readonly",
        __BUILD_TIME__: "readonly",
      },
    },
  },

  {
    files: ["**/*.{ts,vue}"],
    plugins: {
      "import-x": importX,
    },
    settings: {
      "import-x/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      "import-x/no-cycle": "error",
      "import-x/no-self-import": "error",
      "import-x/no-duplicates": "error",
    },
  },

  // Data-access layering: Dexie and the repositories are reachable only from
  // the data layer — the repositories themselves, the query functions, and
  // the services (both the app-wide ones and the module-owned ones, which
  // are the same role co-located with their module). Everything above them —
  // `lib/`, composables, stores, components — goes through a query function
  // or a service. `lib/` is deliberately NOT exempt: it exists in every
  // module, so allowing it would drain the whole data layer into it.
  {
    files: ["src/**/*.{ts,vue}"],
    ignores: [
      "src/db/repositories/**",
      "src/queries/**",
      "src/services/**",
      "src/modules/*/service/**",
      "src/modules/*/services/**",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        // `paths` matches the module specifier exactly, so banning the `db`
        // export here leaves `openDatabase` (bootstrap) and every other
        // module under @/db — entities, storage, errors — alone. A `patterns`
        // group cannot: ESLint matches groups gitignore-style, so "@/db"
        // would swallow "@/db/entities" with it.
        paths: [
          {
            name: "@/db",
            importNames: ["db"],
            message: "db.table напрямую — только внутри репозитория.",
            allowTypeImports: true,
          },
        ],
        patterns: [
          {
            group: [
              "**/db/repositories",
              "**/db/repositories/**",
              "@/db/repositories",
              "@/db/repositories/**",
            ],
            message:
              "Репозитории доступны только из queries/ и services/. "
              + "Из composables и компонентов ходи через query-функции.",
            allowTypeImports: true,
          },
        ],
      }],
    },
  },
  // stats.aggregate is a pure module (no db.table access) that exports
  // SESSION_GAP_MS; sessions.ts needs the same session-gap constant the
  // stats page uses. This is the one named exception to the repositories
  // ban above, scoped to this single file and single module.
  {
    files: ["src/modules/recommendations/lib/sessions.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        paths: [
          {
            name: "@/db",
            importNames: ["db"],
            message: "db.table напрямую — только внутри репозитория.",
            allowTypeImports: true,
          },
        ],
        patterns: [
          {
            group: [
              "**/db/repositories",
              "**/db/repositories/**",
              "@/db/repositories",
              "@/db/repositories/**",
            ],
            message:
              "Репозитории доступны только из queries/ и services/. "
              + "Из composables и компонентов ходи через query-функции.",
            allowTypeImports: true,
          },
        ],
      }],
    },
  },
  // stats.aggregate is a pure module (no db.table access) that exports
  // SESSION_GAP_MS; sessions.ts needs the same session-gap constant the
  // stats page uses. This is the one named exception to the repositories
  // ban above, scoped to this single file. The group must stay one path
  // segment deep (`/*`, not `/**`) — the `ignore` package treats a `/**`
  // (or the bare directory) match as excluding the whole directory, which
  // blocks a later `!` negation from re-including a file inside it.
  {
    files: ["src/modules/recommendations/lib/sessions.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": ["error", {
        paths: [
          {
            name: "@/db",
            importNames: ["db"],
            message: "db.table напрямую — только внутри репозитория.",
            allowTypeImports: true,
          },
        ],
        patterns: [
          {
            group: [
              "**/db/repositories/*",
              "@/db/repositories/*",
              "!@/db/repositories/stats.aggregate",
            ],
            message:
              "Репозитории доступны только из queries/ и services/. "
              + "Из composables и компонентов ходи через query-функции.",
            allowTypeImports: true,
          },
        ],
      }],
    },
  },

  // Import bans share one core rule, and ESLint does not merge a rule's
  // options across config objects (the last match wins), so the full set is
  // composed here once and each exempt location re-applies the set minus
  // what it alone may import.
  {
    files: ["src/**/*.{ts,vue}"],
    rules: restrictImports([BAN_INVOKE, BAN_LISTEN, BAN_SUMMON_COMPONENT], [BAN_IS_TAURI]),
  },
  // The Tauri bridge itself (M3) may use invoke/listen and the raw flag.
  {
    files: ["src/app/tauri-commands.ts"],
    rules: restrictImports([BAN_SUMMON_COMPONENT], []),
  },
  // The capability table, the event wrappers and the root CSS class (§4).
  {
    files: ["src/lib/environment/**", "src/composables/tauri/**", "src/composables/useSetupRootClasses.ts"],
    rules: restrictImports([BAN_INVOKE, BAN_LISTEN, BAN_SUMMON_COMPONENT], []),
  },
  // The keyed dialog wrapper is the one caller of the raw primitive (§6).
  {
    files: ["src/components/dialogs/summonDialog.ts"],
    rules: restrictImports([BAN_INVOKE, BAN_LISTEN], [BAN_IS_TAURI]),
  },

  // Module layering (ARCHITECTURE.md §3). M1: domain code (everything in a
  // module except `components/`) never imports a .vue. M2: core modules never
  // import feature modules. Only .ts files are targeted, so UI stays free to
  // import anything. Type-only imports are not layer crossings and are
  // filtered by the rule itself.
  {
    files: ["src/modules/**/*.ts"],
    rules: {
      "import-x/no-restricted-paths": ["error", {
        basePath: import.meta.dirname,
        zones: [
          {
            target: `./src/modules/{${CORE_MODULES.join(",")}}/**/*.ts`,
            from: `./src/modules/{${FEATURE_MODULES.join(",")}}/**/*`,
            message: "M2: core modules do not import feature modules. Register the feature at bootstrap instead (ARCHITECTURE.md §3).",
          },
          {
            target: "./src/modules/*/!(components)/**/*.ts",
            from: "./src/**/*.vue",
            message: "M1: domain code does not import .vue. Dialogs: summonDialog(key) from @/components/dialogs/summonDialog.",
          },
          {
            target: "./src/modules/*/*.ts",
            from: "./src/**/*.vue",
            message: "M1: domain code does not import .vue.",
          },
        ],
      }],
    },
  },
  // ESLint rejects an empty `files` array, so the block exists only while
  // the list does.
  ...(KNOWN_LAYER_VIOLATIONS.length
    ? [{ files: KNOWN_LAYER_VIOLATIONS, rules: { "import-x/no-restricted-paths": "off" } }]
    : []),

  {
    rules: {
      "vue/multi-word-component-names": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
      "no-void": "error",

      "vue/max-attributes-per-line": [
        "warn",
        {
          singleline: { max: 1 },
          multiline: { max: 1 },
        },
      ],
      // Accessibility
      "vuejs-accessibility/alt-text": "warn",
      "vuejs-accessibility/iframe-has-title": "warn",
      "sonarjs/no-duplicate-string": ["warn", { threshold: 5 }],
      "sonarjs/cognitive-complexity": ["warn", 20],
      "sonarjs/todo-tag": "off",

      "sonarjs/function-return-type": "off",

      "sonarjs/no-selector-parameter": "off",

      "sonarjs/deprecation": "warn",
    },
  },
);
