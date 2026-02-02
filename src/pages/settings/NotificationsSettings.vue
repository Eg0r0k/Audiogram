<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="pb-8">
      <SettingsHeader title="Notifications" />

      <SettingsGroup>
        <SettingsItem
          title="Push notifications"
          subtitle="Receive notifications on device"
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
            Notification types
          </div>
          <div class="text-sm text-muted-foreground">
            Choose what you want to be notified about
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
            <ItemTitle>New music</ItemTitle>
            <ItemSubtitle>From artists you follow</ItemSubtitle>
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
            <ItemTitle>Playlists updates</ItemTitle>
            <ItemSubtitle>When playlists you follow are updated</ItemSubtitle>
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
            <ItemTitle>Artist announcements</ItemTitle>
            <ItemSubtitle>News from artists you follow</ItemSubtitle>
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
            <ItemTitle>Concert alerts</ItemTitle>
            <ItemSubtitle>Events near you</ItemSubtitle>
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
            <ItemTitle>Product news</ItemTitle>
            <ItemSubtitle>New features and tips</ItemSubtitle>
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
