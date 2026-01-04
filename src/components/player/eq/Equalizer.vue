<template>
  <div class="flex flex-col w-full max-w-[450px] py-4 pb-3 px-5 bg-card rounded-sm">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-4">
        <Switch v-model="isEnabled" />

        <h3 class="text-sm font-semibold tracking-wide text-muted-foreground">
          {{ $t('player.equalizer') }}
        </h3>
      </div>

      <div class="flex items-center gap-2">
        <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
        <Select
          v-model="currentPreset"
          @update:model-value="applyPreset()"
        >
          <SelectTrigger class="w-[140px] h-8! bg-background! text-xs font-medium">
            <SelectValue placeholder="Preset" />
          </SelectTrigger>
          <SelectContent class="max-h-[300px]">
            <SelectGroup
              v-for="(label, category) in EQ_PRESET_CATEGORIES"
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
      </div>
    </div>

    <div class="flex gap-3 h-30 select-none">
      <div class="flex flex-col justify-between text-[10px] font-mono text-muted-foreground/60 w-6 text-right">
        <span>+15</span>
        <span>0</span>
        <span>-15</span>
      </div>
      <div
        class="grid grid-cols-10 gap-2 flex-1 transition-opacity duration-300"
        :class="{ 'opacity-50 pointer-events-none grayscale': !isEnabled }"
      >
        <div
          v-for="band in bands"
          :key="band.frequency"
          class="flex flex-col items-center group relative h-full"
        >
          <EditableValue
            v-model="band.gain"
            :min="-15"
            :max="15"
            :step="1"
            suffix=" dB"
            class="absolute -top-4 z-10 [&:focus-within>span]:opacity-100!"
            display-class="text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
            input-class="text-[10px] w-[20px]"
            @change="setCustomPreset"
          />

          <VerticalSlider
            v-model="band.gain"
            :min="-15"
            :max="15"
            :step="1"
            @change="setCustomPreset"
          />

          <span
            class="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mt-1"
          >
            {{ formatFreq(band.frequency) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { usePlayerStore } from "@/stores/player.store";
import VerticalSlider from "./VerticalSlider.vue";
import { Switch } from "@/components/ui/switch";
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
import {
  EQ_FREQUENCIES,
  EQ_PRESETS,
  EQ_PRESET_CATEGORIES,
  getPresetsByCategory,
} from "@/components/player/eq/constants";
import { EditableValue } from "@/components/ui/editable";

const playerStore = usePlayerStore();
const isEnabled = ref(true);
const currentPreset = ref("Flat");

const bands = ref<{ frequency: number; gain: number }[]>(
  EQ_FREQUENCIES.map(f => ({ frequency: f, gain: 0 })),
);

const formatFreq = (hz: number) => {
  if (hz >= 1000) return `${hz / 1000}k`;
  return String(hz);
};

const pushToGraph = () => {
  const audioGraph = playerStore.getAudioGraph();
  if (!audioGraph) return;

  if (audioGraph.eqEnabled !== isEnabled.value) {
    audioGraph.setEQEnabled(isEnabled.value);
  }

  bands.value.forEach((b, i) => {
    if (Math.abs(audioGraph.getEQBand(i) - b.gain) > 0.01) {
      audioGraph.setEQBand(i, b.gain);
    }
  });
};

const pullFromGraph = () => {
  const audioGraph = playerStore.getAudioGraph();
  if (!audioGraph) return;

  if (bands.value.length === audioGraph.bands.length) {
    audioGraph.bands.forEach((b, i) => {
      bands.value[i].gain = b.gain;
    });
    isEnabled.value = audioGraph.eqEnabled;
  }
};

const setCustomPreset = () => {
  currentPreset.value = "custom";
};

const applyPreset = (presetName?: string) => {
  const name = presetName ?? currentPreset.value;
  const preset = EQ_PRESETS[name as keyof typeof EQ_PRESETS];
  if (!preset) return;

  preset.gains.forEach((gain, i) => {
    if (bands.value[i]) {
      bands.value[i].gain = gain;
    }
  });
};
;

watch(
  [bands, isEnabled],
  () => {
    pushToGraph();
  },
  { deep: true },
);

watch(
  () => playerStore.getAudioGraph(),
  (newGraph) => {
    if (newGraph) {
      pushToGraph();
    }
  },
);

onMounted(() => {
  if (playerStore.getAudioGraph()) {
    pullFromGraph();
  }
});
</script>
