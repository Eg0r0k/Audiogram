import { type MockInstance, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent } from "vue";

const logger = vi.hoisted(() => ({ error: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ getLogger: () => logger }));

import { installGlobalErrorHandlers } from "../error-feedback";

describe("installGlobalErrorHandlers", () => {
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    logger.error.mockClear();
    consoleError.mockRestore();
  });

  it("logs a Vue error with the component info", () => {
    const Broken = defineComponent({
      setup: () => {
        throw new Error("boom");
      },
      render: () => null,
    });
    const app = createApp(Broken);
    installGlobalErrorHandlers(app, new EventTarget() as Window);

    app.mount(document.createElement("div"));
    app.unmount();

    expect(logger.error).toHaveBeenCalledWith("[Vue] setup function: unknown/Error: boom");
  });

  it("logs an unhandled rejection through formatError", () => {
    const target = new EventTarget() as Window;
    installGlobalErrorHandlers(createApp({ render: () => null }), target);

    const reason = { domain: "source", kind: "RATE_LIMITED", message: "slow down" };
    target.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason }));

    expect(logger.error).toHaveBeenCalledWith("[Unhandled] source/RATE_LIMITED: slow down");
  });

  it("prints the original error to the console in dev so the stack survives", () => {
    const thrown = new Error("boom");
    const reason = new Error("rejected");
    const target = new EventTarget() as Window;
    const app = createApp({ render: () => null });
    installGlobalErrorHandlers(app, target);

    app.config.errorHandler?.(thrown, null, "setup function");
    target.dispatchEvent(Object.assign(new Event("unhandledrejection"), { reason }));

    expect(consoleError).toHaveBeenCalledWith(thrown);
    expect(consoleError).toHaveBeenCalledWith(reason);
  });
});
