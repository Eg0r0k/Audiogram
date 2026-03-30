<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="pb-8">
      <SettingsHeader title="About" />

      <SettingsGroup>
        <div class="px-4 py-6 flex flex-col items-center">
          <div class="size-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <IconMusic
              class="size-10 text-primary"
            />
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
              variant="link"
              as-child
            >
              <Link
                to="https://github.com/Eg0r0k/AudioGram"
                confirm-external
              >
                <IconGithub
                  class="size-6"
                />
              </Link>
            </Button>
            <Button
              size="icon-lg"
              variant="link"
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
        <SettingsItem
          title="What's new"
          @click="handleOpenWhatsNew"
        >
          <template #action>
            <div class="flex items-center gap-2">
              <span
                v-if="changelog.hasUnseenUpdate"
                class="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
              >
                New
              </span>
              <IconLoader2
                v-if="isOpening"
                class="size-4 animate-spin text-muted-foreground"
              />
              <IconChevronRight
                v-else
                class="size-5 text-muted-foreground"
              />
            </div>
          </template>
        </SettingsItem>

        <SettingsItem title="Share with friends">
          <template #action>
            <IconChevronRight
              class="size-5 text-muted-foreground"
            />
          </template>
        </SettingsItem>
      </SettingsGroup>

      <SettingsGroup class="mt-3">
        <SettingsItem title="Terms of Service">
          <template #action>
            <IconExternalLink
              class="size-5 text-muted-foreground"
            />
          </template>
        </SettingsItem>

        <SettingsItem title="Privacy Policy">
          <template #action>
            <IconExternalLink
              class="size-5 text-muted-foreground"
            />
          </template>
        </SettingsItem>

        <SettingsItem title="Licenses">
          <template #action>
            <IconChevronRight
              class="size-5 text-muted-foreground"
            />
          </template>
        </SettingsItem>
      </SettingsGroup>

      <div class="px-4 py-6 text-center text-xs text-muted-foreground">
        <p class=" inline-flex gap-1 items-center">
          {{ $t('settings.about.madeWith') }} <IconBarBell
            class="size-4"
          />
        </p>

        <p class="mt-1">
          © {{ dateYear }} Audiogram.{{ $t('settings.about.allRightsReserved') }}.
        </p>
      </div>
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import IconMusic from "~icons/tabler/music";
import IconGithub from "~icons/tabler/brand-github-filled";
import IconTelegram from "~icons/tabler/brand-telegram";
import IconChevronRight from "~icons/tabler/chevron-right";
import IconExternalLink from "~icons/tabler/external-link";
import IconBarBell from "~icons/tabler/barbell-filled";
import IconLoader2 from "~icons/tabler/loader-2";
import { toast } from "vue-sonner";

import { Scrollable } from "@/components/ui/scrollable";
import Button from "@/components/ui/button/Button.vue";
import Link from "@/components/ui/link/Link.vue";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsItem from "@/modules/settings/components/SettingsItem.vue";
import SettingsHeader from "@/modules/settings/components/SettingsHeader.vue";
import { useReleaseNotesDialog } from "@/modules/update/composables/useReleaseNotesDialog";
import { useChangelogStore } from "@/modules/update/store/changelog.store";

const dateYear = new Date().getFullYear();
const appVersion = __APP_VERSION__;
const buildTime = __BUILD_TIME__;
const changelog = useChangelogStore();
const {
  isOpening,
  error,
  clearError,
  openCurrent,
} = useReleaseNotesDialog();

const handleOpenWhatsNew = async () => {
  const isOpened = await openCurrent();

  if (isOpened) return;

  toast.error(error.value ?? "Failed to load release notes");
  clearError();
};
</script>
