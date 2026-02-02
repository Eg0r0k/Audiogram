<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="pb-8">
      <SettingsHeader title="Language" />

      <SettingsGroup>
        <RadioGroup
          v-model="selectedLanguage"
          class="gap-0"
        >
          <Item
            v-for="lang in languages"
            :key="lang.code"
            v-ripple
            tabindex="0"
            size="sm"
            class="cursor-pointer"
            @click="handleChangeLanguage(lang.code)"
            @keypress="handleChangeLanguage(lang.code)"
          >
            <ItemMedia>
              <RadioGroupItem :value="lang.code" />
            </ItemMedia>
            <ItemContent class="ml-4">
              <ItemTitle>{{ lang.name }}</ItemTitle>
              <ItemSubtitle>{{ lang.native }}</ItemSubtitle>
            </ItemContent>
          </Item>
        </RadioGroup>
      </SettingsGroup>
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Scrollable } from "@/components/ui/scrollable";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Item, ItemContent, ItemTitle, ItemSubtitle, ItemMedia } from "@/components/ui/item";
import SettingsHeader from "@/modules/settings/components/SettingsHeader.vue";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";

const selectedLanguage = ref("en");

const handleChangeLanguage = (lang: string) => {
  selectedLanguage.value = lang;
};

const languages = [
  { code: "en", name: "English", native: "English" },
  { code: "ru", name: "Russian", native: "Русский" },
  { code: "de", name: "German", native: "Deutsch" },
  { code: "fr", name: "French", native: "Français" },
  { code: "es", name: "Spanish", native: "Español" },
  { code: "it", name: "Italian", native: "Italiano" },
  { code: "pt", name: "Portuguese", native: "Português" },
  { code: "ja", name: "Japanese", native: "日本語" },
  { code: "ko", name: "Korean", native: "한국어" },
  { code: "zh", name: "Chinese", native: "中文" },
];
</script>
