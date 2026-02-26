// modules/settings/store/audio.composable.ts
import { watch } from "vue";
import { storeToRefs } from "pinia";
import { usePlayerStore } from "@/modules/player/store/player.store";
import { useAudioSettingsStore } from "../store/audio";

let watcherRegistered = false;

export function useAudioSettings() {
  const store = useAudioSettingsStore();
  const playerStore = usePlayerStore();

  const {
    isEqEnabled,
    currentPreset,
    bands,
    bandGains,
  } = storeToRefs(store);

  if (!watcherRegistered) {
    watcherRegistered = true;

    watch(
      () => playerStore.graphRevision,
      () => {
        const graph = playerStore.getAudioGraph();
        if (graph) {
          console.log("[EQ] Graph ready, applying saved settings");
          store.pushToGraph();
        }
      },
    );

    if (playerStore.getAudioGraph()) {
      store.pushToGraph();
    }
  }

  return {
    isEqEnabled,
    currentPreset,
    bands,
    bandGains,

    presetCategories: store.presetCategories,
    getPresetsByCategory: store.getPresetsByCategory,

    setBandGain: store.setBandGain,
    applyPreset: store.applyPreset,
    resetEqualizer: store.resetEqualizer,
    setEqEnabled: store.setEqEnabled,
  };
}
