import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, withDirectives } from "vue";
import { vCopy } from "..";

vi.mock("@/lib/logger", () => ({ getLogger: () => ({ error: vi.fn(), warn: vi.fn() }) }));

const writeText = vi.fn<(text: string) => Promise<void>>();
const execCommand = vi.fn<(command: string) => boolean>();

const renderCopyable = (onCopy: () => void, onError: () => void) => render(defineComponent(() =>
  () => withDirectives(h("p", "Path"), [[vCopy, { text: "D:/Music", onCopy, onError }]])));

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe("v-copy", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reports a copy through the clipboard API", async () => {
    writeText.mockResolvedValue(undefined);
    const onCopy = vi.fn();
    const onError = vi.fn();
    renderCopyable(onCopy, onError);

    await fireEvent.click(screen.getByText("Path"));
    await flush();

    expect(onCopy).toHaveBeenCalledWith("D:/Music");
    expect(onError).not.toHaveBeenCalled();
  });

  it("falls back to the legacy copy when the clipboard API refuses", async () => {
    writeText.mockRejectedValue(new Error("not allowed"));
    execCommand.mockReturnValue(true);
    const onCopy = vi.fn();
    const onError = vi.fn();
    renderCopyable(onCopy, onError);

    await fireEvent.click(screen.getByText("Path"));
    await flush();

    expect(onCopy).toHaveBeenCalledWith("D:/Music");
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a failure, not a copy, when neither way worked", async () => {
    writeText.mockRejectedValue(new Error("not allowed"));
    execCommand.mockReturnValue(false);
    const onCopy = vi.fn();
    const onError = vi.fn();
    renderCopyable(onCopy, onError);

    await fireEvent.click(screen.getByText("Path"));
    await flush();

    expect(onCopy).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
