import { onMounted, onUnmounted } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useGeneralSettings } from "../store/general";

export const useTrayBehavior = () => {
  const { closeToTray } = useGeneralSettings();
  const appWindow = getCurrentWindow();
  let unlisten: (() => void) | null = null;

  onMounted(async () => {
    unlisten = await appWindow.onCloseRequested(async (event) => {
      if (closeToTray.value) {
        event.preventDefault();
        await appWindow.hide();
      }
    });
  });

  onUnmounted(() => unlisten?.());
};
