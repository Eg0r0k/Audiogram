<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="pb-8">
      <SettingsHeader :title="$t('settings.index.appearance')" />

      <SettingsGroup>
        <div class="px-4">
          <div class=" text-primary font-medium mb-1">
            Color theme
          </div>
        </div>
        <RadioGroup
          :model-value="theme"
          @update:model-value="(val) => setTheme(val as any)"
        >
          <Item
            v-for="option in themes"
            :key="option.value"
            class="cursor-pointer"
            @click="setTheme(option.value)"
          >
            <RadioGroupItem
              :id="`theme-${option.value}`"
              :value="option.value"
            />
            <ItemContent>
              <ItemTitle>
                {{ option.label }}
              </ItemTitle>
            </ItemContent>
          </Item>
        </RadioGroup>
      </SettingsGroup>

      <SettingsGroup>
        <div class="px-4 py-4">
          <AccentColorPicker
            :model-value="accentColor"
            :colors="accentColors"
            @select="setAccentColor"
          />
        </div>
      </SettingsGroup>
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import { Item, ItemContent, ItemTitle } from "@/components/ui/item";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Scrollable } from "@/components/ui/scrollable";
import AccentColorPicker from "@/modules/settings/components/AccentColorPicker.vue";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsHeader from "@/modules/settings/components/SettingsHeader.vue";
import { useAppearanceSettings } from "@/modules/settings/store/appearance";

const {
  theme, themes, setTheme,
  accentColor, accentColors, setAccentColor,
} = useAppearanceSettings();
</script>
