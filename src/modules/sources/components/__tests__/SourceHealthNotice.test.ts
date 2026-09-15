import { beforeEach, describe, expect, it } from "vitest";
import { renderWithPlugins, screen } from "@/test/utils";
import { forgetSourceHealth, setSourceHealth } from "../../lib/health";
import SourceHealthNotice from "../SourceHealthNotice.vue";

describe("SourceHealthNotice", () => {
  beforeEach(() => {
    forgetSourceHealth();
  });

  it("names a missing subscription instead of blaming the connection", () => {
    setSourceHealth("nd", { state: "failed", error: { kind: "FORBIDDEN", message: "premium only" } });

    renderWithPlugins(SourceHealthNotice, { props: { kind: "nd" } });

    expect(screen.getByText(/subscription/i)).toBeInTheDocument();
    expect(screen.queryByText(/cannot be reached/i)).not.toBeInTheDocument();
  });

  it("tells how long to wait after a rate limit", () => {
    setSourceHealth("nd", {
      state: "failed",
      error: { kind: "RATE_LIMITED", message: "slow down", retryAfterMs: 12_000 },
    });

    renderWithPlugins(SourceHealthNotice, { props: { kind: "nd" } });

    expect(screen.getByText(/too many requests.*12 s/i)).toBeInTheDocument();
  });

  it("still reports an unreachable server as such", () => {
    setSourceHealth("nd", { state: "failed", error: { kind: "NETWORK", message: "timeout" } });

    renderWithPlugins(SourceHealthNotice, { props: { kind: "nd" } });

    expect(screen.getByText(/cannot be reached/i)).toBeInTheDocument();
  });
});
