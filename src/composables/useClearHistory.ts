import { toast } from "vue-sonner";
import { useI18n } from "vue-i18n";
import { summonDialog } from "@/components/dialogs/summonDialog";
import { getLogger } from "@/lib/logger";
import { clearModel } from "@/modules/recommendations/service/recommender-model.service";
import { statsService } from "@/services/stats.service";

export const useClearHistory = () => {
  const { t } = useI18n();

  const clearHistory = async (): Promise<boolean> => {
    const cleared = await summonDialog("clearHistory", {
      clear: async () => {
        try {
          await statsService.clearHistory();
          // Weights fitted on the history just erased must not keep steering autoplay.
          await clearModel();
        }
        catch (error) {
          getLogger().error(`[Stats] Clearing listening history failed: ${String(error)}`);
          toast.error(t("errors.unknown"));
          throw error;
        }
      },
    }, { key: "clear-history" });

    if (cleared) toast.success(t("settings.stats.cleared"));
    return cleared === true;
  };

  return { clearHistory };
};
