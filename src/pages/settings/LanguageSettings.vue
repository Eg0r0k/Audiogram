<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="pb-8">
      <SettingsHeader :title="$t('settings.index.language')" />

      <SettingsGroup>
        <RadioGroup
          :model-value="language"
          class="gap-0"
        >
          <Item
            v-for="lang in languages"
            :key="lang.code"
            v-ripple
            tabindex="0"
            size="sm"
            class="cursor-pointer"
            :class="{ 'bg-accent/10': language === lang.code }"
            @click="setLanguage(lang.code)"
            @keypress.enter.space="setLanguage(lang.code)"
          >
            <ItemMedia>
              <RadioGroupItem :value="lang.code" />
            </ItemMedia>
            <ItemContent class="ml-4">
              <ItemTitle>{{ lang.native }}</ItemTitle>
              <ItemSubtitle class="flex items-center gap-2">
                <span>{{ lang.name }}</span>
                <span
                  v-if="lang.code === 'system'"
                  class="text-xs text-muted-foreground/70"
                >
                  → {{ systemLanguageDisplay }}
                </span>
              </ItemSubtitle>
            </ItemContent>
          </Item>
        </RadioGroup>
      </SettingsGroup>
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Scrollable } from "@/components/ui/scrollable";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Item, ItemContent, ItemTitle, ItemSubtitle, ItemMedia } from "@/components/ui/item";
import SettingsHeader from "@/modules/settings/components/SettingsHeader.vue";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import { useGeneralSettings, LANGUAGE_OPTIONS } from "@/modules/settings/store/general";

const {
  language,
  systemLanguage,
  languages,
  setLanguage,
} = useGeneralSettings();

const systemLanguageDisplay = computed(() => {
  const lang = LANGUAGE_OPTIONS.find(l => l.code === systemLanguage.value);
  return lang?.native || systemLanguage.value;
});
</script>
