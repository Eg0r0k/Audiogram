import { reportError } from "@/app/error-feedback";
import { toaster } from "@/app/toaster";
import { i18n } from "@/app/i18n";
import type { SourceTrackDTO } from "@/modules/sources/types";
import { downloadSubject } from "./service/enqueue";

/**
 * Queues a download for a remote DTO with user feedback: an existing offline
 * copy acknowledges with a toast (the UI can offer the action while its
 * hasCopy query is still loading), a failure reports instead of throwing.
 * Every menu/button entry point shares this so none of them no-ops silently.
 */
export async function downloadDtoWithFeedback(dto: SourceTrackDTO): Promise<void> {
  try {
    const jobId = await downloadSubject({ kind: "remote", dto });
    if (jobId === null) toaster.add({ title: i18n.global.t("downloads.done"), color: "info" });
  }
  catch (error) {
    reportError(error, {
      title: i18n.global.t("downloads.enqueueFailed"),
      scope: "Downloads",
      retry: () => {
        downloadDtoWithFeedback(dto).catch(() => undefined);
      },
    });
  }
}
