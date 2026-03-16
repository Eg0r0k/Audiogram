import { IS_TAURI } from "@/lib/environment/userAgent";
import { usePlayerStore } from "@/modules/player";
import { useQueueStore } from "@/modules/queue/store/queue.store";
import { tryOnScopeDispose } from "@vueuse/core";

export const useTauriGlobalShortcuts = () => {
  if (!IS_TAURI) return;

  let cleanup: (() => Promise<void>) | null = null;

  const registerShortcuts = async () => {
    const { register, unregisterAll } = await import(
      "@tauri-apps/plugin-global-shortcut",
    );

    await unregisterAll();

    const player = usePlayerStore();
    const queue = useQueueStore();

    const shortcuts: Array<{ key: string; handler: () => void }> = [
      {
        key: "MediaPlayPause",
        handler: () => player.togglePlay(),
      },
      {
        key: "MediaStop",
        handler: () => player.stop(),
      },
      {
        key: "MediaTrackNext",
        handler: () => queue.next(),
      },
      {
        key: "MediaTrackPrevious",
        handler: () => queue.previous(),
      },
    ];

    for (const { key, handler } of shortcuts) {
      try {
        await register(key, (event) => {
          if (event.state === "Released") return;
          handler();
        });
      }
      catch (err) {
        console.warn(`[TauriShortcuts] Failed to register "${key}":`, err);
      }
    }

    cleanup = async () => {
      try {
        await unregisterAll();
      }
      catch (err) {
        console.warn("[TauriShortcuts] Failed to unregister:", err);
      }
    };
  };

  registerShortcuts().catch((err) => {
    console.warn("[TauriShortcuts] Plugin not available:", err);
  });

  tryOnScopeDispose(async () => {
    await cleanup?.();
  });
};
