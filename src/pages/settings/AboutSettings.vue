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
        <SettingsItem title="What's new">
          <template #action>
            <IconChevronRight
              class="size-5 text-muted-foreground"
            />
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
          Made with <IconBarBell
            class="size-4"
          />
        </p>

        <p class="mt-1">
          © {{ dateYear }} Audiogram. All rights reserved.
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

import { Scrollable } from "@/components/ui/scrollable";
import SettingsGroup from "@/components/settings/SettingsGroup.vue";
import SettingsItem from "@/components/settings/SettingsItem.vue";
import SettingsHeader from "@/components/settings/SettingsHeader.vue";
import Button from "@/components/ui/button/Button.vue";
import Link from "@/components/ui/link/Link.vue";

const dateYear = new Date().getFullYear();
const appVersion = __APP_VERSION__;
const buildTime = __BUILD_TIME__;
</script>
