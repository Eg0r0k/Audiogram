import { ref } from "vue";

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

  const confirmNavigation = () => {
    if (pendingUrl.value) {
      window.open(pendingUrl.value, "_blank", "noopener,noreferrer");
    }
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
