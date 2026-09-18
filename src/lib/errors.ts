export const errorMessage = (cause: unknown, fallback = "Unknown error"): string => {
  if (cause instanceof Error) return cause.message;
  return typeof cause === "string" ? cause : fallback;
};
