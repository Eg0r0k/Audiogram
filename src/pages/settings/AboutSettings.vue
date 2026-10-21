<template>
  <SettingsScreen :title="$t('settings.index.about')">
    <SettingsGroup>
      <div class="px-4 py-6 flex flex-col items-center">
        <div class="size-20 rounded-2xl bg-primary flex items-center justify-center mb-4">
          <IconLogo class="size-15 text-white" />
        </div>
        <div class="font-semibold text-lg">
          Audiogram
        </div>
        <div class="text-sm text-muted-foreground mb-2">
          Version {{ appVersion }}  ({{ buildTime }})
        </div>
        <div class="flex gap-2">
          <Button
            size="icon-lg"
            variant="ghost"
            as-child
          >
            <Link
              to="https://github.com/Eg0r0k/Audiogram"
              confirm-external
            >
              <IconGithub
                class="size-6"
              />
            </Link>
          </Button>
          <Button
            size="icon-lg"
            variant="ghost"
            as-child
          >
            <Link
              to="https://t.me/EG0RK13"
              confirm-external
            >
              <IconTelegram
                class="size-6"
              />
            </Link>
          </Button>
        </div>
      </div>
    </SettingsGroup>
    <SettingsGroup class="mt-3">
      <Button
        class="w-full h-14 justify-start"
        size="xl"
        variant="ghost"
        :class="{ 'text-destructive': updateStore.status === 'error' }"
        :disabled="updateStore.isBusy"
        :title="updateStore.error?.message"
        @click="updateStore.check()"
      >
        <Spinner
          v-if="updateStore.status === 'checking'"
          class="size-6"
        />
        <IconCheck
          v-else-if="updateStore.status === 'up-to-date'"
          class="size-6"
        />
        <IconAlertTriangle
          v-else-if="updateStore.status === 'error'"
          class="size-6"
        />
        <IconCloudDownload
          v-else
          class="size-6"
        />
        {{ checkStateLabel }}
      </Button>
      <SettingsItem
        :icon="IconSparkles"
        :title="$t('settings.about.whatsNew')"
        :error="releaseNotesError ?? undefined"
        @click="handleOpenWhatsNew"
      >
        <template #action>
          <div class="flex items-center gap-2">
            <span
              v-if="changelog.hasUnseenUpdate"
              class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
            >
              {{ $t("settings.about.newBadge") }}
            </span>
            <Spinner
              v-if="isOpening"
              class="size-4 text-muted-foreground"
            />
            <IconChevronRight
              v-else
              class="size-5 text-muted-foreground"
            />
          </div>
        </template>
      </SettingsItem>
      <SettingsItem
        :icon="IconFileExport"
        :title="$t('settings.about.exportLogs')"
        :error="exportLogsError ?? undefined"
        @click="handleExportLogs"
      >
        <template #action>
          <Spinner
            v-if="isExporting"
            class="size-4 text-muted-foreground"
          />

          <IconDownload
            v-else
            class="size-5 text-muted-foreground"
          />
        </template>
      </SettingsItem>
    </SettingsGroup>

    <SettingsGroup class="mt-3">
      <SettingsItem
        :icon="IconFileDescription"
        :title="$t('settings.about.termsOfService')"
        @click="router.push(routeLocation.settingsTerms())"
      >
        <template #action>
          <IconChevronRight
            class="size-5 text-muted-foreground"
          />
        </template>
      </SettingsItem>

      <SettingsItem
        :icon="IconShieldLock"
        :title="$t('settings.about.privacyPolicy')"
        @click="router.push(routeLocation.settingsPrivacy())"
      >
        <template #action>
          <IconChevronRight
            class="size-5 text-muted-foreground"
          />
        </template>
      </SettingsItem>

      <Link
        to="https://github.com/Eg0r0k/Audiogram/blob/main/LICENSE"
        confirm-external
      >
        <SettingsItem
          :icon="IconLicense"
          :title="$t('settings.about.licenses')"
        >
          <template #action>
            <IconExternalLink
              class="size-5 text-muted-foreground"
            />
          </template>
        </SettingsItem>
      </Link>
    </SettingsGroup>

    <div class="px-4 py-6 text-center text-xs text-muted-foreground">
      <p class=" inline-flex gap-1 items-center">
        {{ $t('settings.about.madeWith') }} <IconBarBell
          class="size-4"
        />
      </p>

      <p class="mt-1">
        © {{ dateYear }} Audiogram. {{ $t('settings.about.allRightsReserved') }}.
      </p>
    </div>
  </SettingsScreen>
</template>

<script setup lang="ts">
import { Spinner } from "@/components/ui/spinner";
import IconGithub from "~icons/tabler/brand-github-filled";
import IconTelegram from "~icons/tabler/brand-telegram";
import IconChevronRight from "~icons/tabler/chevron-right";
import IconExternalLink from "~icons/tabler/external-link";
import IconBarBell from "~icons/tabler/brand-among-us";
import IconDownload from "~icons/tabler/download";
import IconCloudDownload from "~icons/tabler/cloud-download";
import IconCheck from "~icons/tabler/check";
import IconAlertTriangle from "~icons/tabler/alert-triangle";
import IconSparkles from "~icons/tabler/sparkles";
import IconFileExport from "~icons/tabler/file-export";
import IconFileDescription from "~icons/tabler/file-description";
import IconShieldLock from "~icons/tabler/shield-lock";
import IconLicense from "~icons/tabler/license";

import IconLogo from "~icons/audiogram/logo";
import { toaster } from "@/app/toaster";
import { useI18n } from "vue-i18n";

import Button from "@/components/ui/button/Button.vue";
import Link from "@/components/ui/link/Link.vue";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsItem from "@/modules/settings/components/SettingsItem.vue";
import SettingsScreen from "@/modules/settings/components/SettingsScreen.vue";
import { useReleaseNotesDialog } from "@/modules/update/composables/useReleaseNotesDialog";
import { useChangelogStore } from "@/modules/update/store/changelog.store";
import { useUpdateStore } from "@/modules/update/store/update.store";
import { routeLocation } from "@/app/router/route-locations";
import { useRouter } from "vue-router";
import { exportLogs, getLogger } from "@/lib/logger";
import { computed, ref } from "vue";

const isExporting = ref(false);

const router = useRouter();

const dateYear = new Date().getFullYear();
const appVersion = __APP_VERSION__;
const buildTime = __BUILD_TIME__;
const { t } = useI18n();
const changelog = useChangelogStore();
const updateStore = useUpdateStore();

const checkStateLabel = computed(() => {
  switch (updateStore.status) {
    case "checking":
      return t("update.checking");
    case "up-to-date":
      return t("update.upToDate");
    case "error":
      return t("update.updaterError");
    default:
      return t("update.checkForUpdates");
  }
});

const {
  isOpening,
  error,
  clearError,
  openCurrent,
} = useReleaseNotesDialog();

const exportLogsError = ref<string | null>(null);
const releaseNotesError = ref<string | null>(null);

const handleExportLogs = async () => {
  exportLogsError.value = null;
  isExporting.value = true;
  await exportLogs().match(
    (success) => {
      if (success.kind === "saved")
        toaster.add({ title: t("settings.about.logsExportedTo", { path: success.path }), color: "success" });
      if (success.kind === "downloaded")
        toaster.add({ title: t("settings.about.logsDownloaded", { filename: success.filename }), color: "success" });
    },
    (err) => {
      if (err.type === "NO_DATA")
        toaster.add({ title: t("settings.about.logsEmpty"), color: "warning" });
      else {
        getLogger().error(`[AboutSettings] Exporting logs failed: ${err.reason}`);
        exportLogsError.value = t("settings.about.logsExportFailed");
      }
    },
  );

  isExporting.value = false;
};

const handleOpenWhatsNew = async () => {
  releaseNotesError.value = null;
  const isOpened = await openCurrent();

  if (isOpened) return;

  getLogger().warn(`[AboutSettings] Loading release notes failed: ${error.value ?? "unknown"}`);
  releaseNotesError.value = t("settings.about.releaseNotesLoadFailed");
  clearError();
};

</script>
