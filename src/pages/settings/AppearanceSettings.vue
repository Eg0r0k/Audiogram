<template>
  <SettingsScreen :title="$t('settings.index.appearance')">
    <SettingsGroup>
      <div class="px-4">
        <div class=" text-primary font-medium mb-1">
          {{ $t("settings.appearance.colorTheme") }}
        </div>
      </div>
      <RadioGroup
        :model-value="theme"
        :aria-label="$t('settings.appearance.colorTheme')"
        class="grid grid-cols-1 gap-3 px-4 pt-2 pb-4 sm:grid-cols-3 sm:gap-4"
        @update:model-value="(val) => setTheme(val as any)"
      >
        <label
          v-for="option in themes"
          :key="option.value"
          :for="`theme-${option.value}`"
          class="group/theme flex min-w-0 cursor-pointer items-center gap-3 sm:flex-col sm:items-stretch"
        >
          <span
            class="block w-28 shrink-0 overflow-hidden rounded-lg transition-shadow sm:w-auto"
            :class="theme === option.value
              ? 'ring-2 ring-primary'
              : ''"
          >
            <ThemePreview
              :theme="option.value"
              :contrast="isHighContrast"
            />
          </span>
          <span class="flex min-w-0 items-center gap-2">
            <Radio
              :id="`theme-${option.value}`"
              :value="option.value"
            />
            <span class="truncate text-sm font-medium">
              {{ $t(`settings.appearance.themes.${option.value}`) }}
            </span>
          </span>
        </label>
      </RadioGroup>
    </SettingsGroup>

    <SettingsGroup>
      <Item>
        <ItemContent>
          <ItemTitle>{{ $t("settings.appearance.contrast") }}</ItemTitle>
          <ItemDescription>{{ $t("settings.appearance.contrastDescription") }}</ItemDescription>
        </ItemContent>
        <ItemActions class="max-sm:w-full">
          <Tabs
            class="max-sm:w-full"
            :model-value="contrast"
            @update:model-value="(val) => setContrast(val as ContrastMode)"
          >
            <TabsList
              class="gap-1 max-sm:w-full"
              :aria-label="$t('settings.appearance.contrast')"
            >
              <TabsTrigger
                v-for="option in contrastModes"
                :key="option"
                :value="option"
              >
                {{ $t(`settings.appearance.contrastModes.${option}`) }}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </ItemActions>
      </Item>
    </SettingsGroup>

    <SettingsGroup>
      <div class="px-4 py-4">
        <div class="mb-3 text-primary font-medium">
          {{ $t("settings.appearance.accentColor") }}
        </div>
        <AccentColorPicker
          :model-value="accentColor"
          :colors="accentColors"
          :custom-color="customAccentColor"
          @select="setAccentColor"
          @select-custom="setCustomAccentColor"
        />
      </div>
    </SettingsGroup>

    <SettingsGroup>
      <div class="px-4">
        <div class=" text-primary font-medium mb-1">
          {{ $t("settings.appearance.font") }}
        </div>
      </div>
      <RadioGroup
        :model-value="font"
        @update:model-value="(val) => setFont(val as FontId)"
      >
        <Item
          v-for="preset in fonts"
          :key="preset.id"
          class="cursor-pointer"
          @click="setFont(preset.id)"
        >
          <Radio
            :id="`font-${preset.id}`"
            :value="preset.id"
          />
          <ItemContent :style="{ fontFamily: fontPreviewStack(preset.id) }">
            <ItemTitle>
              {{ $t(`settings.appearance.fonts.${preset.id}`) }}
            </ItemTitle>
            <ItemDescription>
              {{ $t("settings.appearance.fontSample") }}
            </ItemDescription>
          </ItemContent>
        </Item>
      </RadioGroup>
    </SettingsGroup>

    <template v-if="platformCaps.hasZoom">
      <SettingsGroup class="mt-2">
        <Item>
          <ItemContent>
            <ItemTitle>{{ $t("settings.appearance.zoom") }}</ItemTitle>
          </ItemContent>
          <ItemActions>
            <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -- renderless reka root, the trigger below carries the label -->
            <Select
              :model-value="String(zoom)"
              @update:model-value="(val) => setZoom(Number(val) as any)"
            >
              <SelectTrigger
                size="lg"
                variant="soft"
                class="w-22.5 font-medium pointer-events-auto"
                :aria-label="$t('settings.appearance.zoom')"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="level in zoomLevels"
                  :key="level"
                  :value="String(level)"
                >
                  {{ level }}%
                </SelectItem>
              </SelectContent>
            </Select>
          </ItemActions>
        </Item>
      </SettingsGroup>
    </template>
  </SettingsScreen>
</template>

<script setup lang="ts">
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "@/components/ui/item";
import { RadioGroup, Radio } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AccentColorPicker from "@/modules/settings/components/AccentColorPicker.vue";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsScreen from "@/modules/settings/components/SettingsScreen.vue";
import ThemePreview from "@/modules/settings/components/ThemePreview.vue";
import { useAppearanceSettings } from "@/modules/settings/store/appearance";
import { type ContrastMode, useContrast } from "@/modules/settings/composables/useContrast";
import { useZoom } from "@/modules/settings/composables/useZoom";
import { useFont } from "@/modules/settings/composables/useFont";
import type { FontId } from "@/modules/settings/fonts";
import { fontPreviewStack } from "@/modules/settings/fonts";
import { platformCaps } from "@/lib/environment/platformCaps";

const {
  theme, themes, setTheme,
  contrast, contrastModes, setContrast,
  accentColor, accentColors, setAccentColor,
  customAccentColor, setCustomAccentColor,
} = useAppearanceSettings();

const { isHighContrast } = useContrast();

const {
  zoom, zoomLevels, setZoom,
} = useZoom();

const {
  font, fonts, setFont, preloadAllFonts,
} = useFont();

preloadAllFonts();

</script>
