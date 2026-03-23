export const formatDuration = (s: number): string => {
  if (!isFinite(s) || s < 0) return "0:00";
  const totalSeconds = Math.floor(Math.abs(s));

  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const formatTotalDuration = (
  seconds: number,
  t: (key: string, params?: Record<string, unknown>) => string,
): string => {
  if (!isFinite(seconds) || seconds <= 0) {
    return t("common.minutesShort", { count: 0 });
  }

  const totalMinutes = Math.floor(seconds / 60);

  if (totalMinutes < 60) {
    return t("common.minutesShort", { count: totalMinutes });
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return t("common.hoursShort", { count: hours });
  }

  return `${t("common.hoursShort", { count: hours })} ${t("common.minutesShort", { count: minutes })}`;
};
