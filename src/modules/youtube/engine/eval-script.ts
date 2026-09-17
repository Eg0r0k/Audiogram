/**
 * Runs a player script youtubei.js built (`JsExtractor.buildScript` output
 * plus its `return process(...)` tail) and returns what it returns — the
 * `{ n, sig }` the player asked for. Only ever called inside the evaluator
 * worker, where no Tauri IPC and no DOM exist.
 */
export const runPlayerScript = (output: string): Record<string, unknown> => {
  const result: unknown = new Function(output)();
  if (typeof result !== "object" || result === null) {
    throw new Error("player script returned no object");
  }
  return result as Record<string, unknown>;
};
