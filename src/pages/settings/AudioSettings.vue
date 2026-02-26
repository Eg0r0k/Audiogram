<template>
  <Scrollable
    direction="vertical"
    class="flex-1"
  >
    <div class="pb-8">
      <SettingsHeader :title="$t('settings.index.audio')" />

      <SettingsGroup>
        <Item @click="setEqEnabled(!isEqEnabled)">
          <ItemContent>
            <ItemTitle>{{ $t('settings.audio.equalizer') }}</ItemTitle>
            <ItemDescription>
              {{ $t('settings.audio.equalizerDesc') }}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Switch
              :model-value="isEqEnabled"
              @click.stop
              @update:model-value="setEqEnabled"
            />
          </ItemActions>
        </Item>
        <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
        <Select

          :model-value="currentPreset"
          @update:model-value="(val) => applyPreset(val as string)"
        >
          <SelectTrigger class="w-fit bg-background! text-xs font-medium">
            <SelectValue placeholder="Preset" />
          </SelectTrigger>
          <SelectContent class="max-h-[300px]">
            <SelectGroup
              v-for="(label, category) in presetCategories"
              :key="category"
            >
              <SelectLabel>{{ label }}</SelectLabel>
              <SelectItem
                v-for="preset in getPresetsByCategory(category)"
                :key="preset.name"
                :value="preset.name"
              >
                {{ preset.name }}
              </SelectItem>
            </SelectGroup>
            <SelectSeparator />
            <SelectItem value="custom">
              Custom
            </SelectItem>
          </SelectContent>
        </Select>
        <div class="px-4 pt-4 pb-2">
          <div class="flex gap-3 h-32 select-none">
            <div class="flex flex-col justify-between text-[10px] font-mono text-muted-foreground/60 w-6 text-right">
              <span>+15</span>
              <span>0</span>
              <span>-15</span>
            </div>

            <div
              class="grid grid-cols-10 gap-2 flex-1 transition-opacity duration-300"
              :class="{ 'opacity-40 pointer-events-none grayscale': !isEqEnabled }"
            >
              <div
                v-for="(band, index) in bands"
                :key="band.frequency"
                class="flex flex-col items-center group relative h-full"
              >
                <EditableValue
                  :model-value="band.gain"
                  :min="-15"
                  :max="15"
                  :step="1"
                  suffix=" dB"
                  class="absolute -top-4 z-10 [&:focus-within>span]:opacity-100!"
                  display-class="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                  input-class="text-[10px] w-[20px]"
                  @update:model-value="(val: number) => setBandGain(index, val)"
                />

                <VerticalSlider
                  :model-value="band.gain"
                  :min="-15"
                  :max="15"
                  :step="1"
                  @update:model-value="(val: number) => setBandGain(index, val)"
                />

                <span class="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mt-1">
                  {{ formatFreq(band.frequency) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup class="mt-2">
        <Button
          class="w-full justify-start"
          size="xl"
          variant="ghost-primary"
          @click="resetEqualizer"
        >
          <TrashIcon class=" size-6" />
          Reset EQ
        </Button>
      </SettingsGroup>
    </div>
  </Scrollable>
</template>

<script setup lang="ts">
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
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
import { Scrollable } from "@/components/ui/scrollable";
import { EditableValue } from "@/components/ui/editable";

import VerticalSlider from "@/modules/player/components/eq/VerticalSlider.vue";
import SettingsGroup from "@/modules/settings/components/SettingsGroup.vue";
import SettingsHeader from "@/modules/settings/components/SettingsHeader.vue";

import { Button } from "@/components/ui/button";
import { useAudioSettings } from "@/modules/settings/composables/useAudioSettings";

import TrashIcon from "~icons/tabler/trash";

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

function formatFreq(hz: number): string {
  return hz >= 1000 ? `${hz / 1000}k` : String(hz);
}
</script>
