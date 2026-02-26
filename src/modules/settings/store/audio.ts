import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { usePlayerStore } from "@/modules/player/store/player.store";
import {
  EQ_FREQUENCIES,
  EQ_PRESETS,
  EQ_PRESET_CATEGORIES,
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

  const bands = computed<EQBand[]>(() =>
    EQ_FREQUENCIES.map((f, i) => ({
      frequency: f,
      gain: bandGains.value[i] ?? 0,
    })),
  );

  function pushToGraph() {
    const playerStore = usePlayerStore();
    const graph = playerStore.getAudioGraph();
    console.log("[EQ] pushToGraph called, graph:", graph);
    console.log("[EQ] isEqEnabled:", isEqEnabled.value);
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

  return {
    // State (persisted)
    isEqEnabled,
    currentPreset,
    bandGains,

    // Derived
    bands,

    // Constants
    presetCategories: EQ_PRESET_CATEGORIES,
    getPresetsByCategory,

    // Actions
    setBandGain,
    applyPreset,
    resetEqualizer,
    setEqEnabled,
    pushToGraph,
  };
}, {
  persist: {
    key: "audiogram-audio-settings",
    pick: ["isEqEnabled", "currentPreset", "bandGains"],
  },
});
