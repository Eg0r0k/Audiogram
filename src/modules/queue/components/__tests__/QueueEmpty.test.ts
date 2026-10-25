import { render, screen } from "@testing-library/vue";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/app/i18n";
import { routeLocation } from "@/app/router/route-locations";
import QueueEmpty from "../QueueEmpty.vue";

const push = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));

const renderEmpty = () => render(QueueEmpty, { global: { plugins: [i18n] } });

describe("QueueEmpty", () => {
  beforeEach(() => {
    i18n.global.locale.value = "en";
    push.mockReset().mockResolvedValue(undefined);
  });

  it("explains the empty queue under the logo", () => {
    renderEmpty();

    expect(screen.getByText("Your queue is empty")).toBeInTheDocument();
    expect(screen.getByText("Play an album, a playlist or any track to fill it.")).toBeInTheDocument();
  });

  it("opens All Music from the empty queue", async () => {
    renderEmpty();

    await userEvent.click(screen.getByRole("button", { name: "Open All Music" }));

    expect(push).toHaveBeenCalledWith(routeLocation.allMusic());
  });
});
