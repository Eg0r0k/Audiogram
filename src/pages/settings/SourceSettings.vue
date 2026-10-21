<template>
  <SettingsScreen :title="$t(ui.labelKey)">
    <SettingsGroup>
      <Item class="gap-8">
        <ItemMedia>
          <component
            :is="ui.icon"
            class="size-6 text-muted-foreground"
          />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>{{ $t(ui.labelKey) }}</ItemTitle>
          <ItemDescription>
            <SourceStatusLabel :kind="kind" />
          </ItemDescription>
        </ItemContent>
      </Item>
    </SettingsGroup>

    <component
      :is="settingsForm"
      v-if="settingsForm"
    />

    <SettingsGroup
      v-if="canCheck"
      class="pt-0!"
    >
      <Button
        class="w-full h-14 justify-start"
        size="xl"
        variant="ghost"
        :disabled="!isAvailable || isChecking"
        @click="checkSource(kind)"
      >
        <Spinner
          v-if="isChecking"
          class="size-6"
        />
        <IconPlugConnected
          v-else
          class="size-6"
        />
        {{ $t("source.status.check") }}
      </Button>
    </SettingsGroup>
  </SettingsScreen>
</template>

<script setup lang="ts">
import { computed, type Component } from "vue";
import { useRoute } from "vue-router";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import IconPlugConnected from "~icons/tabler/plug-connected";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsScreen from "@/modules/settings/components/SettingsScreen.vue";
import { sources } from "@/modules/sources";
import SourceStatusLabel from "@/modules/sources/components/SourceStatusLabel.vue";
import NdSettingsSection from "@/modules/sources/components/settings/NdSettingsSection.vue";
import YmSettingsSection from "@/modules/sources/components/settings/YmSettingsSection.vue";
import { checkSource } from "@/modules/sources/composables/useSourceHealth";
import { sourceHealth } from "@/modules/sources/lib/health";
import { sourceUI } from "@/modules/sources/lib/source-ui";
import type { RemoteSourceKind } from "@/types/track-ref";

//
// Sources are compiled in statically, so the form a source needs is looked up
// in a static map here rather than carried on the provider: SourceProvider is
// a data contract and has no business referencing Vue components. A source
// with no form (YouTube: nothing to configure) still gets its status row.
//

const SOURCE_SETTINGS: Partial<Record<RemoteSourceKind, Component>> = {
  nd: NdSettingsSection,
  ym: YmSettingsSection,
};

const route = useRoute();
// The route guard only lets registered kinds through.
const kind = computed(() => route.params.kind as RemoteSourceKind);

const provider = computed(() => sources.all().find(candidate => candidate.id === kind.value));
const ui = computed(() => sourceUI(kind.value));
const settingsForm = computed(() => SOURCE_SETTINGS[kind.value]);
const isAvailable = computed(() => provider.value?.isAvailable ?? false);
const canCheck = computed(() => !!provider.value?.checkConnection);

// The verdict itself (connected, or the error) is the status row at the top.
const isChecking = computed(() => sourceHealth(kind.value).state === "checking");
</script>
