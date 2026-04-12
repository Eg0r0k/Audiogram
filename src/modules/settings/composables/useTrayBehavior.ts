import { watch, onUnmounted } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useGeneralSettings } from "../store/general";

export const useTrayBehavior = () => {
  const { closeToTray } = useGeneralSettings();
  const appWindow = getCurrentWindow();
  let unlisten: (() => void) | null = null;

  const registerListener = async () => {
    unlisten?.();
    unlisten = null;

    if (!closeToTray.value) return;

    unlisten = await appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      await appWindow.hide();
    });
  };

  watch(closeToTray, registerListener, { immediate: true });

  onUnmounted(() => {
    unlisten?.();
    unlisten = null;
  });
};
