<!-- eslint-disable vuejs-accessibility/form-control-has-label -->
<template>
  <SettingsGroup>
    <Item @click="setEqEnabled(!isEqEnabled)">
      <ItemContent>
        <ItemTitle>{{ $t('player.equalizer') }}</ItemTitle>
      </ItemContent>
      <ItemActions>
        <Switch
          :model-value="isEqEnabled"
          @click.stop
          @update:model-value="setEqEnabled"
        />
      </ItemActions>
    </Item>

    <div
      class="px-4 pb-4 pt-2 transition-[opacity,filter] duration-300 max-w-3xl mx-auto"
      :class="{ 'opacity-40 pointer-events-none grayscale': !isEqEnabled }"
    >
      <div class="flex items-center justify-between mb-8">
        <div class="flex items-center gap-3">
          <Select
            :model-value="currentPreset"
            @update:model-value="(val) => applyPreset(val as string)"
          >
            <SelectTrigger
              variant="soft"
              class="w-45 h-8 font-medium"
            >
              <SelectValue :placeholder="$t('settings.audio.selectPreset')" />
            </SelectTrigger>
            <SelectContent class="max-h-75">
              <SelectGroup
                v-for="(label, category) in presetCategories"
                :key="category"
              >
                <SelectLabel>{{ label }}</SelectLabel>
                <SelectItem
                  v-for="preset in getPresetsByCategory(category)"
                  :key="preset.name"
                  class="font-medium"
                  :value="preset.name"
                >
                  {{ preset.name }}
                </SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectItem value="custom">
                {{ $t("settings.audio.customPreset") }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          size="sm"
          variant="ghost"
          @click="resetEqualizer"
        >
          <TrashIcon class="size-4.5" />

          {{ $t("settings.audio.resetEqualizer") }}
        </Button>
      </div>

      <div class="flex gap-4 h-48 select-none">
        <!-- <div class="flex flex-col justify-between py-2  font-medium text-muted-foreground/60 text-right w-6">
          <span>+15</span>
          <span>0</span>
          <span>-15</span>
        </div> -->

        <div class="grid grid-cols-10 gap-1.5 flex-1">
          <div
            v-for="(band, index) in bands"
            :key="band.frequency"
            class="flex flex-col items-center group relative h-full"
          >
            <Editable
              :model-value="String(band.gain)"
              activation-mode="dblclick"
              submit-mode="both"
              select-on-focus
              class="absolute -top-6 z-10 text-[11px] font-bold text-primary"
              :title="$t('common.editHint')"
              @submit="(value) => submitGain(index, value)"
            >
              <EditableArea class=" text-foreground   focus-within:opacity-100 transition-opacity">
                <EditablePreview class="whitespace-nowrap">
                  {{ formatGain(band.gain) }}
                </EditablePreview>
                <EditableInput
                  inputmode="numeric"
                  :aria-label="$t('common.editLabel')"
                  class="text-center"
                />
              </EditableArea>
            </Editable>

            <VerticalSlider
              :model-value="band.gain"
              :min="-15"
              :max="15"
              :step="1"
              class="flex-1"
              @update:model-value="(val: string | number) => setBandGain(index, val as number)"
            />

            <span class="text-[10px] font-semibold text-muted-foreground mt-3">
              {{ formatFreq(band.frequency) }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </SettingsGroup>
</template>

<script setup lang="ts">
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Editable, EditableArea, EditableInput, EditablePreview } from "@/components/ui/editable";

import VerticalSlider from "@/modules/player/components/eq/VerticalSlider.vue";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";

import { Button } from "@/components/ui/button";
import { useAudioSettings } from "@/modules/settings/composables/useAudioSettings";

import TrashIcon from "~icons/tabler/trash";
import { formatFreq } from "@/lib/format";

const {
  isEqEnabled,
  currentPreset,
  bands,
  presetCategories,
  getPresetsByCategory,
  setBandGain,
  applyPreset,
  resetEqualizer,
  setEqEnabled,
} = useAudioSettings();

const GAIN_LIMIT = 15;

const formatGain = (gain: number) => `${gain > 0 ? "+" : ""}${gain} dB`;

// Unparsable input leaves the stored gain, and the bound value with it, as is.
const submitGain = (index: number, value: string | null | undefined) => {
  const gain = Math.round(Number.parseFloat(value ?? ""));
  if (Number.isNaN(gain)) return;
  setBandGain(index, Math.min(GAIN_LIMIT, Math.max(-GAIN_LIMIT, gain)));
};
</script>
