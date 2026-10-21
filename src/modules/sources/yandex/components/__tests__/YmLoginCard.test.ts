import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { fireEvent, render, screen } from "@testing-library/vue";
import { i18n } from "@/app/i18n";

const invokeCommand = vi.hoisted(() => vi.fn());
const openExternal = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@/app/tauri-commands", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/tauri-commands")>();
  return { ...actual, invokeCommand, listenEvent: vi.fn(() => Promise.resolve(() => {})) };
});
vi.mock("@/composables/useExternalLinkInterceptor", () => ({ openExternal }));
vi.mock("@/queries/source.queries", () => ({ invalidateSource: vi.fn(() => Promise.resolve()) }));
vi.mock("@/lib/environment/userAgent", () => ({ IS_TAURI: true, IS_MOBILE: false, IS_WINDOWS: true }));
vi.mock("@/lib/logger", () => ({ getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }) }));

import { toaster } from "@/app/toaster";
import { vCopy } from "@/directives/copy";
import { useYmAuthStore } from "../../store/ym-auth.store";
import YmLoginCard from "../YmLoginCard.vue";

const CODE = { userCode: "fzlazd3z", verificationUrl: "https://ya.ru/device", expiresIn: 300, interval: 5 };

let pinia = createPinia();
const renderCard = () => render(YmLoginCard, { global: { plugins: [pinia, i18n], directives: { copy: vCopy } } });
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const shownTitles = (color: string) => vi.mocked(toaster.add).mock.calls
  .map(([toast]) => toast)
  .filter(toast => toast.color === color)
  .map(toast => toast.title);

describe("YmLoginCard", () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    invokeCommand.mockReset();
    openExternal.mockClear();
    i18n.global.locale.value = "en";
    vi.spyOn(toaster, "add").mockReturnValue("toast").mockClear();
  });

  it("offers to sign in when nobody is signed in", async () => {
    invokeCommand.mockResolvedValue(CODE);
    renderCard();

    await fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(invokeCommand).toHaveBeenCalledWith("ym_auth_start");
  });

  it("shows the code, opens Yandex and can cancel while the code is pending", async () => {
    invokeCommand.mockResolvedValue(undefined);
    useYmAuthStore().beginPending(CODE, Date.now());
    renderCard();

    expect(screen.getByText("fzlazd3z")).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /open yandex/i }));
    expect(openExternal).toHaveBeenCalledWith("https://ya.ru/device");

    await fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(invokeCommand).toHaveBeenCalledWith("ym_auth_cancel");
  });

  it("names the account and its subscription once signed in, and can sign out", async () => {
    invokeCommand.mockResolvedValue(undefined);
    useYmAuthStore().applyStatus({ loggedIn: true, uid: 42, hasPlus: false, displayName: "Tester" });
    renderCard();

    expect(screen.getByText(/signed in as tester/i)).toBeInTheDocument();
    expect(screen.getByText(/no plus/i)).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(invokeCommand).toHaveBeenCalledWith("ym_auth_logout");
  });

  it("reports a sign-out that failed", async () => {
    invokeCommand.mockRejectedValue(new Error("keyring locked"));
    useYmAuthStore().applyStatus({ loggedIn: true, uid: 42, hasPlus: false, displayName: "Tester" });
    renderCard();

    await fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await flush();

    expect(shownTitles("destructive")).toEqual(["Couldn't sign out of Yandex Music"]);
  });

  it("says when the code could not be copied", async () => {
    Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("denied")) }, configurable: true });
    Object.defineProperty(document, "execCommand", { value: () => false, configurable: true });
    useYmAuthStore().beginPending(CODE, Date.now());
    renderCard();

    await fireEvent.click(screen.getByText("fzlazd3z"));
    await flush();

    expect(shownTitles("success")).toEqual([]);
    expect(shownTitles("destructive")).toEqual(["Couldn't copy"]);
  });

  it("an expired session shows the banner and the way back in", () => {
    const store = useYmAuthStore();
    store.applyStatus({ loggedIn: true, uid: 42, hasPlus: true, displayName: "Tester" });
    store.applyEvent({ status: "expired" });
    renderCard();

    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("an expired code offers a new one", async () => {
    invokeCommand.mockResolvedValue(CODE);
    const store = useYmAuthStore();
    store.beginPending(CODE, 0);
    store.applyEvent({ status: "codeExpired" });
    renderCard();

    expect(screen.getByText(/code expired/i)).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: /new code/i }));
    expect(invokeCommand).toHaveBeenCalledWith("ym_auth_start");
  });

  it("never renders anything that looks like a token", () => {
    useYmAuthStore().applyStatus({ loggedIn: true, uid: 42, hasPlus: true, displayName: "Tester" });
    const { container } = renderCard();

    expect(container.textContent).not.toMatch(/OAuth|y0_|refresh/i);
  });
});
