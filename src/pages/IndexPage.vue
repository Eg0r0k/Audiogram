<template>
  <div
    v-if="isMobileLayout"
    class="flex flex-1 min-h-0 flex-col"
  >
    <LibrarySidebar class="h-full bg-card" />
  </div>
  <Scrollable
    v-else
    class="flex-1"
  >
    <div class="@container relative flex flex-col gap-8 items-center justify-center min-h-full px-6 py-10 bg-background">
      <IconLogo class=" text-accent size-45" />
      <div class="flex w-full flex-col items-center gap-6 @3xl:flex-row @3xl:items-stretch @3xl:justify-center @3xl:gap-8">
        <div class="flex flex-col w-80">
          <Button
            v-for="action in quickActions"
            :key="action.labelKey"
            variant="ghost"
            color="muted"
            class="w-full justify-start"
            @click="action.run"
          >
            <component
              :is="action.icon"
              class="size-5"
            />
            {{ $t(action.labelKey) }}
          </Button>
        </div>
        <Separator class="max-w-80 @3xl:h-auto @3xl:max-w-none @3xl:w-(--separator-size)" />
        <div class="flex flex-col gap-2 w-80 px-3">
          <div
            v-for="shortcut in shortcuts"
            :key="shortcut.labelKey"
            class="flex w-full items-center justify-between gap-4"
          >
            <span class=" text-sm text-muted-foreground font-medium">
              {{ $t(shortcut.labelKey, shortcut.params ?? {}) }}
            </span>

            <KbdGroup class="shrink-0">
              <Kbd
                v-for="key in shortcut.keys"
                :key="key"
              >
                {{ key }}
              </Kbd>
            </KbdGroup>
          </div>
        </div>
      </div>
    </div>
  </Scrollable>
</template>
<script lang="ts" setup>
import type { Component } from "vue";
import { useRouter, type RouteLocationRaw } from "vue-router";
import { useI18n } from "vue-i18n";
import LibrarySidebar from "@/components/layout/sidebar/LibrarySidebar.vue";
import { Button } from "@/components/ui/button";
import { KbdGroup, Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import Scrollable from "@/components/ui/scrollable/Scrollable.vue";
import { useDeviceLayout } from "@/composables/useDeviceLayout";
import { routeLocation } from "@/app/router/route-locations";
import { reportError } from "@/app/error-feedback";
import { platformCaps } from "@/lib/environment/platformCaps";
import { MOD_KEY_LABEL } from "@/lib/environment/keyboard";
import { formatError } from "@/lib/errors";
import { getLogger } from "@/lib/logger";
import { SEEK_STEP } from "@/modules/hotkeys";
import { useImport } from "@/modules/library/composables/useImport";
import { useWatchedFolders } from "@/modules/watched-folders/composables/useWatchedFolders";
import IconLogo from "~icons/audiogram/logo";
import IconFolderPlus from "~icons/tabler/folder-plus";
import IconFileImport from "~icons/tabler/file-import";
import IconPlugConnected from "~icons/tabler/plug-connected";
import IconSettings from "~icons/tabler/settings";

interface QuickAction {
  labelKey: string;
  icon: Component;
  available?: boolean;
  run: () => void;
}

interface Shortcut {
  labelKey: string;
  params?: Record<string, unknown>;
  keys: string[];
}

const { isMobileLayout } = useDeviceLayout();
const router = useRouter();
const { t } = useI18n();
const { pickAndImport } = useImport();
const { addFolder } = useWatchedFolders();

const reportFailure = (action: string) => (error: unknown) => {
  getLogger().error(`[IndexPage] ${action} failed: ${formatError(error)}`);
};

const navigate = (to: RouteLocationRaw, action: string) => () => {
  router.push(to).catch(reportFailure(action));
};

const quickActions = ([
  {
    labelKey: "home.actions.addFolder",
    icon: IconFolderPlus,
    available: platformCaps.hasFs,
    run: () => {
      addFolder().then((failed) => {
        if (failed) reportError(null, { title: failed, scope: "IndexPage" });
      }, reportFailure("Adding a watched folder"));
    },
  },
  {
    labelKey: "home.actions.importFiles",
    icon: IconFileImport,
    run: () => {
      pickAndImport({ title: t("common.import.button") }).catch(reportFailure("Importing files"));
    },
  },
  {
    labelKey: "home.actions.connectSource",
    icon: IconPlugConnected,
    run: navigate(routeLocation.settingsSources(), "Opening sources"),
  },
  {
    labelKey: "home.actions.settings",
    icon: IconSettings,
    run: navigate(routeLocation.settings(), "Opening settings"),
  },
] satisfies QuickAction[]).filter(action => action.available ?? true);

const shortcuts: Shortcut[] = [
  { labelKey: "nav.search", keys: [MOD_KEY_LABEL, "F"] },
  { labelKey: "nav.queue", keys: ["Q"] },
  { labelKey: "home.shortcuts.previousNext", keys: [MOD_KEY_LABEL, "← / →"] },
  { labelKey: "home.shortcuts.seek", params: { seconds: SEEK_STEP }, keys: ["Shift", "← / →"] },
  { labelKey: "home.shortcuts.volume", keys: ["↑ / ↓"] },
  { labelKey: "home.shortcuts.mute", keys: ["M"] },
  { labelKey: "home.shortcuts.shuffle", keys: ["S"] },
  { labelKey: "home.shortcuts.repeat", keys: ["R"] },
];
</script>
