<template>
  <Teleport to="body">
    <Motion
      :animate="showOffline ? { y: 0 } : { y: '100%' }"
      :transition="{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }"
      :initial="{ y: '100%' }"
      class="network-bar offline-bar"
      aria-live="assertive"
      role="status"
    >
      <span class="network-label">{{ $t('common.offline') }}</span>
    </Motion>

    <Motion
      :animate="showOnline ? { y: 0 } : { y: '100%' }"
      :transition="{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }"
      :initial="{ y: '100%' }"
      class="network-bar online-bar"
      aria-live="polite"
      role="status"
    >
      <span class="network-label"> {{ $t("common.restored") }}</span>
    </Motion>
  </Teleport>
</template>

<script setup lang="ts">
import { Motion } from "motion-v";
import { useNetworkStatus } from "@/composables/useNetworkStatus";

const { showOffline, showOnline } = useNetworkStatus();
</script>

<style scoped>
.network-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 28px;
  z-index: 9999;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.offline-bar {
  background: var(--secondary);
}

.online-bar {
  background: var(--primary);
}

.network-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--foreground);
  letter-spacing: 0.02em;
  line-height: 1;
}
</style>
