<template>
  <SettingsGroup class="mt-2">
    <div class="px-4 py-3 space-y-3">
      <p class="text-xs text-muted-foreground">
        {{ $t("settings.sources.ym.disclaimer") }}
      </p>
      <YmLoginCard />
    </div>
  </SettingsGroup>

  <SettingsGroup
    v-if="loggedIn"
    class="mt-2"
  >
    <Item @click="setEnabled(!enabled)">
      <ItemContent>
        <ItemTitle>{{ $t("settings.sources.ym.enable") }}</ItemTitle>
        <ItemSubtitle>{{ $t("settings.sources.ym.description") }}</ItemSubtitle>
      </ItemContent>
      <ItemActions>
        <Switch
          :model-value="enabled"
          @click.stop
          @update:model-value="setEnabled"
        />
      </ItemActions>
    </Item>
  </SettingsGroup>
</template>

<script setup lang="ts">
import { Switch } from "@/components/ui/switch";
import { Item, ItemActions, ItemContent, ItemTitle } from "@/components/ui/item";
import ItemSubtitle from "@/components/ui/item/ItemSubtitle.vue";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import { useYmSourceSettings } from "@/modules/settings/store/sources";
import { useYmAuth } from "@/modules/sources/yandex/composables/useYmAuth";
import YmLoginCard from "@/modules/sources/yandex/components/YmLoginCard.vue";

// Signing in is the configuration; the switch only exists once there is an
// account to switch off without signing out.

const { enabled, setEnabled } = useYmSourceSettings();
const { loggedIn } = useYmAuth();
</script>
