import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { closeDialogs, openForResult, renderDialogHost } from "@/test/dialogs";
import { closeDialogsOnLeave } from "../close-dialogs.middleware";

const Probe = defineComponent(() => () => h("p", "probe"));

const makeRouter = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/:pathMatch(.*)*", component: { render: () => null } }],
  });
  router.afterEach(closeDialogsOnLeave);
  await router.push("/all");
  return router;
};

const settled = (promise: Promise<unknown>) => {
  let done = false;
  promise.then(() => (done = true), () => (done = true));
  return () => done;
};

afterEach(closeDialogs);

describe("closeDialogsOnLeave", () => {
  it("closes an open dialog when the page changes", async () => {
    renderDialogHost();
    const router = await makeRouter();
    const result = openForResult(Probe);

    await router.push("/album/a1");

    await expect(result).resolves.toBeUndefined();
  });

  it("keeps it open for a change of query or hash on the same page", async () => {
    renderDialogHost();
    const router = await makeRouter();
    const isSettled = settled(openForResult(Probe));

    await router.replace("/all?search=abc");
    await router.replace("/all#top");
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(isSettled()).toBe(false);
  });
});
