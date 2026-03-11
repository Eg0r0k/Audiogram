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
    isFadeEnabled,
    fadeInDuration,
    fadeOutDuration,
  } = storeToRefs(store);

  if (!watcherRegistered) {
    watcherRegistered = true;

    watch(
      () => playerStore.graphRevision,
      () => {
        const graph = playerStore.getAudioGraph();
        if (graph) {
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
    isFadeEnabled,
    fadeInDuration,
    fadeOutDuration,

    presetCategories: store.presetCategories,
    getPresetsByCategory: store.getPresetsByCategory,

    setBandGain: store.setBandGain,
    applyPreset: store.applyPreset,
    resetEqualizer: store.resetEqualizer,
    setEqEnabled: store.setEqEnabled,
    setFadeEnabled: store.setFadeEnabled,
    setFadeInDuration: store.setFadeInDuration,
    setFadeOutDuration: store.setFadeOutDuration,
  };
}
