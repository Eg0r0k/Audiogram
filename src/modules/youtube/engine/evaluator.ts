import { Platform, type Types } from "youtubei.js";
import EvalWorker from "./eval.worker?worker";
import type { EvalReply, EvalRequest } from "./eval.worker";

//
// youtubei.js deciphers stream URLs by running a script it extracts from
// YouTube's player JS. That script must not run in the main frame: with
// `withGlobalTauri` the frame exposes `window.__TAURI__`, and the code comes
// from a remote party. A dedicated worker has neither Tauri IPC nor a DOM.
//

/** A cold WebView2 worker plus a player script finishes well under this. */
const DEFAULT_TIMEOUT_MS = 10_000;

export interface WorkerLike {
  postMessage: (message: EvalRequest) => void;
  terminate: () => void;
  onmessage: ((event: MessageEvent<EvalReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

interface Pending {
  resolve: (result: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface Evaluator {
  evaluate: (output: string) => Promise<Record<string, unknown>>;
  dispose: () => void;
}

/**
 * Promise bridge over the evaluator worker. A timeout or a worker crash
 * rejects every in-flight call and drops the worker, so the next call starts
 * from a fresh one instead of queueing behind a wedged script.
 */
export const createEvaluator = (spawn: () => WorkerLike, timeoutMs = DEFAULT_TIMEOUT_MS): Evaluator => {
  let worker: WorkerLike | null = null;
  const pending = new Map<number, Pending>();
  let seq = 0;

  const restart = (error: Error) => {
    worker?.terminate();
    worker = null;
    for (const entry of pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    pending.clear();
  };

  const settle = (reply: EvalReply) => {
    const entry = pending.get(reply.id);
    if (!entry) return;
    pending.delete(reply.id);
    clearTimeout(entry.timer);
    if ("error" in reply) entry.reject(new Error(reply.error));
    else entry.resolve(reply.result);
  };

  const ensureWorker = (): WorkerLike => {
    if (worker) return worker;
    const spawned = spawn();
    spawned.onmessage = event => settle(event.data);
    spawned.onerror = event => restart(new Error(`evaluator worker failed: ${event.message}`));
    worker = spawned;
    return spawned;
  };

  const evaluate = (output: string): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`player script evaluation timed out after ${timeoutMs} ms`));
        restart(new Error("evaluator restarted after a timeout"));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      ensureWorker().postMessage({ id, output });
    });

  return {
    evaluate,
    dispose: () => restart(new Error("evaluator disposed")),
  };
};

let installed: Evaluator | null = null;

/** Points youtubei.js at the worker evaluator. Idempotent. */
export const installEvaluator = (evaluator?: Evaluator): Evaluator => {
  if (installed && !evaluator) return installed;
  installed = evaluator ?? createEvaluator(() => new EvalWorker());
  const active = installed;
  Platform.shim.eval = (data: Types.BuildScriptResult) => active.evaluate(data.output);
  return active;
};
