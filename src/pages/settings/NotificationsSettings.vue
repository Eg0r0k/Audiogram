<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="pb-8">
      <SettingsHeader :title="$t('settings.index.notifications')" />

      <SettingsGroup>
        <SettingsItem
          :title="$t('settings.notifications.pushNotifications')"
          :subtitle="$t('settings.notifications.pushNotificationsDescription')"
          @click="pushEnabled = !pushEnabled"
        >
          <template #action>
            <Switch v-model="pushEnabled" />
          </template>
        </SettingsItem>
      </SettingsGroup>

      <SettingsGroup class="mt-3">
        <div class="px-4 py-3">
          <div class="text-primary font-medium mb-1">
            {{ $t("settings.notifications.typesTitle") }}
          </div>
          <div class="text-sm text-muted-foreground">
            {{ $t("settings.notifications.typesDescription") }}
          </div>
        </div>

        <Item
          v-ripple
          size="sm"
          class="cursor-pointer"
          @click="newMusic = !newMusic"
        >
          <ItemMedia>
            <Checkbox
              :model-value="newMusic"
              size="lg"
              @click.stop
            />
          </ItemMedia>
          <ItemContent class="ml-4">
            <ItemTitle>{{ $t("settings.notifications.newMusic") }}</ItemTitle>
            <ItemSubtitle>{{ $t("settings.notifications.newMusicDescription") }}</ItemSubtitle>
          </ItemContent>
        </Item>

        <Item
          v-ripple
          size="sm"
          class="cursor-pointer"
          @click="playlistUpdates = !playlistUpdates"
        >
          <ItemMedia>
            <Checkbox
              :model-value="playlistUpdates"
              size="lg"
              @click.stop
            />
          </ItemMedia>
          <ItemContent class="ml-4">
            <ItemTitle>{{ $t("settings.notifications.playlistsUpdates") }}</ItemTitle>
            <ItemSubtitle>{{ $t("settings.notifications.playlistsUpdatesDescription") }}</ItemSubtitle>
          </ItemContent>
        </Item>

        <Item
          v-ripple
          size="sm"
          class="cursor-pointer"
          @click="artistAnnouncements = !artistAnnouncements"
        >
          <ItemMedia>
            <Checkbox
              :model-value="artistAnnouncements"
              size="lg"
              @click.stop
            />
          </ItemMedia>
          <ItemContent class="ml-4">
            <ItemTitle>{{ $t("settings.notifications.artistAnnouncements") }}</ItemTitle>
            <ItemSubtitle>{{ $t("settings.notifications.artistAnnouncementsDescription") }}</ItemSubtitle>
          </ItemContent>
        </Item>

        <Item
          v-ripple
          size="sm"
          class="cursor-pointer"
          @click="concertAlerts = !concertAlerts"
        >
          <ItemMedia>
            <Checkbox
              :model-value="concertAlerts"
              size="lg"
              @click.stop
            />
          </ItemMedia>
          <ItemContent class="ml-4">
            <ItemTitle>{{ $t("settings.notifications.concertAlerts") }}</ItemTitle>
            <ItemSubtitle>{{ $t("settings.notifications.concertAlertsDescription") }}</ItemSubtitle>
          </ItemContent>
        </Item>
      </SettingsGroup>

      <SettingsGroup class="mt-3">
        <Item
          v-ripple
          size="sm"
          class="cursor-pointer"
          @click="productNews = !productNews"
        >
          <ItemMedia>
            <Checkbox
              :model-value="productNews"
              size="lg"
              @click.stop
            />
          </ItemMedia>
          <ItemContent class="ml-4">
            <ItemTitle>{{ $t("settings.notifications.productNews") }}</ItemTitle>
            <ItemSubtitle>{{ $t("settings.notifications.productNewsDescription") }}</ItemSubtitle>
          </ItemContent>
        </Item>
      </SettingsGroup>
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Scrollable } from "@/components/ui/scrollable";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Item, ItemContent, ItemMedia, ItemSubtitle, ItemTitle } from "@/components/ui/item";
import SettingsHeader from "@/modules/settings/components/SettingsHeader.vue";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsItem from "@/modules/settings/components/SettingsItem.vue";

const pushEnabled = ref(true);
const newMusic = ref(true);
const playlistUpdates = ref(true);
const artistAnnouncements = ref(false);
const concertAlerts = ref(true);
const productNews = ref(false);
</script>
