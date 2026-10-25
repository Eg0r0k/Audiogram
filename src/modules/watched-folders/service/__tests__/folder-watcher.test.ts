import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  watch: vi.fn(),
  exists: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  watch: mocks.watch,
  exists: mocks.exists,
}));
vi.mock("@/lib/logger", () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { startWatching } from "../folder-watcher";

const FOLDER = "/music";

describe("startWatching", () => {
  // Reset per test: a stale callback would silently drive the previous test's
  // watcher, whose closures are all still alive, instead of failing.
  let watcherCallback: ((event: { paths: string[] }) => void) | null = null;

  const emit = (event: { paths: string[] }) => {
    if (!watcherCallback) throw new Error("watcher callback was never registered");
    watcherCallback(event);
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    watcherCallback = null;
    mocks.exists.mockResolvedValue(true);
    mocks.watch.mockImplementation(async (_path: string, callback: (e: { paths: string[] }) => void) => {
      watcherCallback = callback;
      return () => {};
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports every changed path when several files land in one debounce window", async () => {
    const onChange = vi.fn();
    await startWatching(FOLDER, onChange, vi.fn());

    // The watcher emits one event per file; all three fall inside the window.
    emit({ paths: [`${FOLDER}/a.mp3`] });
    emit({ paths: [`${FOLDER}/b.m4a`] });
    emit({ paths: [`${FOLDER}/c.flac`] });

    await vi.advanceTimersByTimeAsync(2000);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect([...onChange.mock.calls[0][0]].sort()).toEqual([
      `${FOLDER}/a.mp3`,
      `${FOLDER}/b.m4a`,
      `${FOLDER}/c.flac`,
    ]);
  });

  it("does not repeat a path that a previous window already reported", async () => {
    const onChange = vi.fn();
    await startWatching(FOLDER, onChange, vi.fn());

    emit({ paths: [`${FOLDER}/a.mp3`] });
    await vi.advanceTimersByTimeAsync(2000);

    // Two events in the second window: with a single one the pre-fix
    // implementation would satisfy this too, so it would guard nothing.
    emit({ paths: [`${FOLDER}/b.mp3`] });
    emit({ paths: [`${FOLDER}/c.mp3`] });
    await vi.advanceTimersByTimeAsync(2000);

    expect(onChange).toHaveBeenCalledTimes(2);
    expect([...onChange.mock.calls[1][0]].sort()).toEqual([`${FOLDER}/b.mp3`, `${FOLDER}/c.mp3`]);
  });

  it("re-queues the batch when the flush fails, instead of losing those files", async () => {
    const onChange = vi.fn();
    await startWatching(FOLDER, onChange, vi.fn());

    mocks.exists.mockRejectedValueOnce(new Error("IPC hiccup"));
    emit({ paths: [`${FOLDER}/a.mp3`, `${FOLDER}/b.mp3`] });
    await vi.advanceTimersByTimeAsync(2000);
    expect(onChange).not.toHaveBeenCalled();

    emit({ paths: [`${FOLDER}/c.mp3`] });
    await vi.advanceTimersByTimeAsync(2000);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect([...onChange.mock.calls[0][0]].sort()).toEqual([
      `${FOLDER}/a.mp3`,
      `${FOLDER}/b.mp3`,
      `${FOLDER}/c.mp3`,
    ]);
  });

  it("reports nothing once the caller stopped watching", async () => {
    const onChange = vi.fn();
    const stop = await startWatching(FOLDER, onChange, vi.fn());

    emit({ paths: [`${FOLDER}/a.mp3`] });
    stop();

    await vi.advanceTimersByTimeAsync(2000);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not report the folder missing once the caller stopped watching", async () => {
    const onMissing = vi.fn();
    let settleExists: (value: boolean) => void = () => {};
    mocks.exists.mockReturnValueOnce(new Promise<boolean>((resolve) => {
      settleExists = resolve;
    }));
    const stop = await startWatching(FOLDER, vi.fn(), onMissing);

    emit({ paths: [`${FOLDER}/a.mp3`] });
    await vi.advanceTimersByTimeAsync(2000);

    // The flush is parked on the probe; restartAffectedWatchers swaps the
    // watcher out from under it and the probe then answers for the old one.
    stop();
    settleExists(false);
    await vi.advanceTimersByTimeAsync(0);

    expect(onMissing).not.toHaveBeenCalled();
  });

  it("excludes a nested folder whose stored path uses backslashes", async () => {
    const onChange = vi.fn();
    await startWatching(FOLDER, onChange, vi.fn(), ["\\music\\nested"]);

    emit({ paths: [`${FOLDER}/nested/inner.mp3`, `${FOLDER}/outer.mp3`] });

    await vi.advanceTimersByTimeAsync(2000);

    expect(onChange).toHaveBeenCalledWith([`${FOLDER}/outer.mp3`]);
  });

  it("flushes during a sustained copy instead of waiting for it to finish", async () => {
    const onChange = vi.fn();
    await startWatching(FOLDER, onChange, vi.fn());

    // The native watcher batches at delayMs 1000, always shorter than the
    // 1500 ms debounce, so a long copy would re-arm it indefinitely.
    for (let i = 0; i < 10; i++) {
      emit({ paths: [`${FOLDER}/f${i}.mp3`] });
      await vi.advanceTimersByTimeAsync(1000);
    }

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.flatMap(c => c[0]).length).toBeGreaterThan(0);
  });

  it("drops paths that are not importable audio", async () => {
    const onChange = vi.fn();
    await startWatching(FOLDER, onChange, vi.fn());

    emit({ paths: [`${FOLDER}/cover.jpg`, `${FOLDER}/notes.txt`, `${FOLDER}/song.m4a`] });

    await vi.advanceTimersByTimeAsync(2000);

    expect(onChange).toHaveBeenCalledWith([`${FOLDER}/song.m4a`]);
  });

  it("reports the folder missing instead of importing when it disappeared", async () => {
    const onChange = vi.fn();
    const onMissing = vi.fn();
    mocks.exists.mockResolvedValue(false);
    await startWatching(FOLDER, onChange, onMissing);

    emit({ paths: [`${FOLDER}/a.mp3`] });

    await vi.advanceTimersByTimeAsync(2000);

    expect(onMissing).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("excludes paths under a nested watched folder", async () => {
    const onChange = vi.fn();
    await startWatching(FOLDER, onChange, vi.fn(), [`${FOLDER}/nested`]);

    emit({ paths: [`${FOLDER}/nested/inner.mp3`, `${FOLDER}/outer.mp3`] });

    await vi.advanceTimersByTimeAsync(2000);

    expect(onChange).toHaveBeenCalledWith([`${FOLDER}/outer.mp3`]);
  });
});
