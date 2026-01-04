<template>
  <div class="flex flex-col w-full max-w-[450px] py-4 pb-3 px-5 bg-card rounded-sm">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <h3 class="text-sm font-semibold tracking-wide uppercase text-muted-foreground/80">
          Equalizer
        </h3>

        <Switch v-model="isEnabled" />
      </div>

      <div class="flex items-center gap-2">
        <!-- eslint-disable-next-line vuejs-accessibility/form-control-has-label -->
        <Select
          v-model="currentPreset"
          @update:model-value="applyPreset()"
        >
          <SelectTrigger class="w-[130px] h-8! bg-background! text-xs  font-medium">
            <SelectValue placeholder="Preset" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Presets</SelectLabel>
              <SelectItem
                v-for="(_, name) in presets"
                :key="name"
                :value="name"
              >
                {{ name }}
              </SelectItem>
              <SelectItem value="custom">
                Custom
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div class="flex gap-3 h-30 select-none">
      <div class="flex flex-col justify-between  text-[10px] font-mono text-muted-foreground/60 w-6 text-right">
        <span>+12</span>
        <span>0</span>
        <span>-12</span>
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
          <div class="absolute -top-5 text-[10px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {{ band.gain > 0 ? '+' : '' }}{{ Math.round(band.gain) }}
          </div>

          <div class="flex-1 w-full flex justify-center py-1 relative">
            <div class="absolute top-1/2 left-0 right-0 h-[1px] bg-foreground/10 pointer-events-none z-0" />

            <VerticalSlider
              v-model="band.gain"
              :min="-12"
              :max="12"
              :step="0.5"
              class="z-10"
              @change="setCustomPreset"
            />
          </div>

          <span class="text-[9px] font-medium text-muted-foreground uppercase tracking-wider mt-1">
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import IconRefresh from "~icons/tabler/refresh";

const playerStore = usePlayerStore();
const isEnabled = ref(true);
const currentPreset = ref("Flat");

const DEFAULT_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

const bands = ref<{ frequency: number; gain: number }[]>(
  DEFAULT_FREQUENCIES.map(f => ({ frequency: f, gain: 0 })),
);

const presets: Record<string, number[]> = {
  "Flat": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Bass Boost": [5, 4, 3, 2, 0, 0, 0, 0, 0, 0],
  "Vocal Boost": [-2, -2, -1, 0, 3, 3, 3, 1, 0, 0],
  "Treble Boost": [0, 0, 0, 0, 0, 1, 2, 3, 4, 5],
  "Pop": [-1, 1, 3, 2, 1, -1, -2, -1, 1, 2],
  "Rock": [4, 3, 1, 0, -1, -2, -1, 0, 2, 4],
  "Jazz": [2, 2, 0, -1, -1, -1, 0, 1, 2, 3],
};

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

const applyPreset = (val?: string) => {
  const presetName = typeof val === "string" ? val : currentPreset.value;
  const gains = presets[presetName];
  if (!gains) return;

  gains.forEach((gain, i) => {
    if (bands.value[i]) {
      bands.value[i].gain = gain;
    }
  });
};
const resetEq = () => {
  currentPreset.value = "Flat";
  applyPreset("Flat");
};

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
