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

  // ARCHITECTURE.md §5 (M3): the Rust bridge is reached only through the
  // typed registry. Type imports (Channel, Event) stay free.
  {
    files: ["src/**/*.{ts,vue}"],
    ignores: ["src/app/tauri-commands.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          { name: "@tauri-apps/api/core", importNames: ["invoke"], message: "M3: use invokeCommand(COMMANDS.x) from @/app/tauri-commands." },
          { name: "@tauri-apps/api/event", importNames: ["listen"], message: "M3: use listenEvent(EVENTS.x) from @/app/tauri-commands." },
        ],
      }],
    },
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
