import { ref } from "vue";
import { openExternal } from "../useExternalLinkInterceptor";

const isOpen = ref(false);
const pendingUrl = ref<string | null>(null);

export function useExternalLinkDialog() {
  const openDialog = (url: string) => {
    pendingUrl.value = url;
    isOpen.value = true;
  };

  const closeDialog = () => {
    isOpen.value = false;
    pendingUrl.value = null;
  };

  const confirmNavigation = async () => {
    const url = pendingUrl.value;
    if (!url) return;

    await openExternal(url).catch(() => undefined);
    closeDialog();
  };

  return {
    isOpen,
    pendingUrl,
    openDialog,
    closeDialog,
    confirmNavigation,
  };
}
