/**
 * Runs a player script youtubei.js built (`JsExtractor.buildScript` output
 * plus its `return process(...)` tail) and returns what it returns — the
 * `{ n, sig }` the player asked for. Only ever called inside the evaluator
 * worker, where no Tauri IPC and no DOM exist.
 */
export const runPlayerScript = (output: string): Record<string, unknown> => {
  // Evaluating YouTube's code is the whole job here; the worker boundary is the sandbox.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, sonarjs/code-eval
  const result: unknown = new Function(output)();
  if (typeof result !== "object" || result === null) {
    throw new Error("player script returned no object");
  }
  return result as Record<string, unknown>;
};
