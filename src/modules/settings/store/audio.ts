import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { usePlayerStore } from "@/modules/player/store/player.store";
import {
  EQ_FREQUENCIES,
  EQ_PRESETS,
  EQ_PRESET_CATEGORIES,
  FADE_DURATION_MIN,
  FADE_DURATION_MAX,
  FADE_DURATION_DEFAULT,
  getPresetsByCategory,
  type EQPresetKey,
} from "../schema/audio";

export interface EQBand {
  frequency: number;
  gain: number;
}

export const useAudioSettingsStore = defineStore("audio-settings", () => {
  const isEqEnabled = ref(true);
  const currentPreset = ref<EQPresetKey>("Flat");
  const bandGains = ref<number[]>(Array.from({ length: 10 }, () => 0));

  const isFadeEnabled = ref(false);
  const fadeInDuration = ref(FADE_DURATION_DEFAULT);
  const fadeOutDuration = ref(FADE_DURATION_DEFAULT);

  const bands = computed<EQBand[]>(() =>
    EQ_FREQUENCIES.map((f, i) => ({
      frequency: f,
      gain: bandGains.value[i] ?? 0,
    })),
  );

  function pushToGraph() {
    const playerStore = usePlayerStore();
    const graph = playerStore.getAudioGraph();
    if (!graph) return;

    if (graph.eqEnabled !== isEqEnabled.value) {
      graph.setEQEnabled(isEqEnabled.value);
    }

    bandGains.value.forEach((gain, i) => {
      if (Math.abs(graph.getEQBand(i) - gain) > 0.01) {
        graph.setEQBand(i, gain);
      }
    });
  }

  function setBandGain(index: number, gain: number) {
    if (index >= 0 && index < bandGains.value.length) {
      bandGains.value[index] = gain;
      currentPreset.value = "custom";
      pushToGraph();
    }
  }

  function applyPreset(presetName?: string) {
    const name = presetName ?? currentPreset.value;
    const preset = EQ_PRESETS[name as keyof typeof EQ_PRESETS];
    if (!preset) return;

    currentPreset.value = name as EQPresetKey;
    preset.gains.forEach((gain, i) => {
      bandGains.value[i] = gain;
    });
    pushToGraph();
  }

  function resetEqualizer() {
    currentPreset.value = "Flat";
    applyPreset("Flat");
  }

  function setEqEnabled(enabled: boolean) {
    isEqEnabled.value = enabled;
    pushToGraph();
  }

  function setFadeEnabled(enabled: boolean) {
    isFadeEnabled.value = enabled;
  }

  function setFadeInDuration(duration: number) {
    fadeInDuration.value = Math.max(
      FADE_DURATION_MIN,
      Math.min(FADE_DURATION_MAX, duration),
    );
  }

  function setFadeOutDuration(duration: number) {
    fadeOutDuration.value = Math.max(
      FADE_DURATION_MIN,
      Math.min(FADE_DURATION_MAX, duration),
    );
  }

  return {
    isEqEnabled,
    currentPreset,
    bandGains,

    isFadeEnabled,
    fadeInDuration,
    fadeOutDuration,

    bands,

    presetCategories: EQ_PRESET_CATEGORIES,
    getPresetsByCategory,

    setBandGain,
    applyPreset,
    resetEqualizer,
    setEqEnabled,
    pushToGraph,
    setFadeEnabled,
    setFadeInDuration,
    setFadeOutDuration,
  };
}, {
  persist: {
    key: "audiogram-audio-settings",
    pick: [
      "isEqEnabled",
      "currentPreset",
      "bandGains",
      "isFadeEnabled",
      "fadeInDuration",
      "fadeOutDuration",
    ],
  },
});
