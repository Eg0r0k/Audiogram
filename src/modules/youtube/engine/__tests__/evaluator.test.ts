import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../eval.worker?worker", () => ({ default: class {} }));

import { runPlayerScript } from "../eval-script";
import { createEvaluator, type WorkerLike } from "../evaluator";
import type { EvalReply, EvalRequest } from "../eval.worker";

/** The shape `JsExtractor.buildScript` + `getNsigProcessorFn` produce, reduced to what matters. */
const STUB_SCRIPT = `
const exportedVars = (function () {
  const nsigFunction = (url, sp, s) => new URL(url.replace("n=", "n=deciphered-") + "&" + sp + "=" + s.split("").reverse().join(""));
  return { nsigFunction };
})({});
const built = exportedVars.nsigFunction("https://ytjs.googlevideo.com/videoplayback?n=abc", "sig", "xyz");
return { n: built.searchParams.get("n"), sig: built.searchParams.get("sig") };
`;

/** Runs scripts inline, like the real worker, unless told to stay silent. */
class FakeWorker implements WorkerLike {
  static spawned: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<EvalReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;

  constructor(private readonly silent = false) {
    FakeWorker.spawned.push(this);
  }

  postMessage(message: EvalRequest) {
    if (this.silent) return;
    queueMicrotask(() => {
      try {
        this.onmessage?.({ data: { id: message.id, result: runPlayerScript(message.output) } } as MessageEvent<EvalReply>);
      }
      catch (error) {
        this.onmessage?.({ data: { id: message.id, error: (error as Error).message } } as MessageEvent<EvalReply>);
      }
    });
  }

  terminate() {
    this.terminated = true;
  }
}

describe("runPlayerScript", () => {
  it("returns the n and sig the built script computes", () => {
    expect(runPlayerScript(STUB_SCRIPT)).toEqual({ n: "deciphered-abc", sig: "zyx" });
  });

  it("rejects a script that returns no object", () => {
    expect(() => runPlayerScript("return 42")).toThrow(/no object/);
  });
});

describe("createEvaluator", () => {
  beforeEach(() => {
    FakeWorker.spawned = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips a script through the worker and reuses the worker", async () => {
    const evaluator = createEvaluator(() => new FakeWorker());

    await expect(evaluator.evaluate(STUB_SCRIPT)).resolves.toEqual({ n: "deciphered-abc", sig: "zyx" });
    await expect(evaluator.evaluate(STUB_SCRIPT)).resolves.toEqual({ n: "deciphered-abc", sig: "zyx" });

    expect(FakeWorker.spawned).toHaveLength(1);
  });

  it("surfaces a script error as a rejection without dropping the worker", async () => {
    const evaluator = createEvaluator(() => new FakeWorker());

    await expect(evaluator.evaluate("throw new Error('boom')")).rejects.toThrow("boom");
    await expect(evaluator.evaluate(STUB_SCRIPT)).resolves.toBeTruthy();

    expect(FakeWorker.spawned).toHaveLength(1);
  });

  it("times out a silent worker, terminates it and starts a fresh one next time", async () => {
    vi.useFakeTimers();
    let silent = true;
    const evaluator = createEvaluator(() => new FakeWorker(silent), 1_000);

    const hung = evaluator.evaluate(STUB_SCRIPT);
    const rejection = expect(hung).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(1_000);
    await rejection;
    expect(FakeWorker.spawned[0].terminated).toBe(true);

    silent = false;
    vi.useRealTimers();
    await expect(evaluator.evaluate(STUB_SCRIPT)).resolves.toBeTruthy();
    expect(FakeWorker.spawned).toHaveLength(2);
  });

  it("rejects every in-flight call when the worker crashes", async () => {
    const evaluator = createEvaluator(() => new FakeWorker(true));

    const first = evaluator.evaluate(STUB_SCRIPT);
    const second = evaluator.evaluate(STUB_SCRIPT);
    const worker = FakeWorker.spawned[0];
    worker.onerror?.({ message: "crashed" } as ErrorEvent);

    await expect(first).rejects.toThrow(/crashed/);
    await expect(second).rejects.toThrow(/crashed/);
    expect(worker.terminated).toBe(true);
  });
});
