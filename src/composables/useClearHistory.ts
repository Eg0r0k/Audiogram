import { toaster } from "@/app/toaster";
import { useI18n } from "vue-i18n";
import { summonDialog } from "@/components/dialogs/summonDialog";
import { getLogger } from "@/lib/logger";
import { statsService } from "@/services/stats.service";
import { formatError } from "@/lib/errors";

export const useClearHistory = () => {
  const { t } = useI18n();

  const clearHistory = async (): Promise<boolean> => {
    const cleared = await summonDialog("confirmWipe", {
      title: t("settings.stats.clearDialogTitle"),
      description: t("settings.stats.clearDialogDesc"),
      confirmLabel: t("settings.stats.clearConfirm"),
      failedText: t("settings.stats.clearFailed"),
      run: async () => {
        try {
          await statsService.clearHistory();
        }
        catch (error) {
          getLogger().error(`[Stats] Clearing listening history failed: ${formatError(error)}`);
          throw error;
        }
      },
    }, { key: "clear-history" });

    if (cleared) toaster.add({ title: t("settings.stats.cleared"), color: "success" });
    return cleared === true;
  };

  return { clearHistory };
};
