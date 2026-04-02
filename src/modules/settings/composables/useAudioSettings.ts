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
    isNormalizationEnabled,
    normalizationTargetLufs,
    normalizationPreventClipping,
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

        if (playerStore.player) {
          store.pushNormalizationToPlayer();
        }
      },
    );

    if (playerStore.getAudioGraph()) {
      store.pushToGraph();
    }

    if (playerStore.player) {
      store.pushNormalizationToPlayer();
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
    isNormalizationEnabled,
    normalizationTargetLufs,
    normalizationPreventClipping,

    presetCategories: store.presetCategories,
    getPresetsByCategory: store.getPresetsByCategory,

    setBandGain: store.setBandGain,
    applyPreset: store.applyPreset,
    resetEqualizer: store.resetEqualizer,
    setEqEnabled: store.setEqEnabled,

    setFadeEnabled: store.setFadeEnabled,
    setFadeInDuration: store.setFadeInDuration,
    setFadeOutDuration: store.setFadeOutDuration,

    setNormalizationEnabled: store.setNormalizationEnabled,
    setNormalizationTargetLufs: store.setNormalizationTargetLufs,
    setNormalizationPreventClipping: store.setNormalizationPreventClipping,
  };
}
