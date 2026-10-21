import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent } from "vue";

const logger = vi.hoisted(() => ({ error: vi.fn(), debug: vi.fn() }));
vi.mock("@/lib/logger", () => ({ getLogger: () => logger }));

import { installGlobalErrorHandlers } from "../error-feedback";

describe("installGlobalErrorHandlers", () => {
  afterEach(() => {
    logger.error.mockClear();
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
});
