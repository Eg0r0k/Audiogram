import { render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import SettingsItem from "../SettingsItem.vue";

describe("SettingsItem", () => {
  it("shows an error in place of the subtitle, with a warning icon", () => {
    render(SettingsItem, { props: { title: "Export logs", subtitle: "Save the app log", error: "Couldn't export the logs" } });

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Couldn't export the logs");
    expect(alert.querySelector("svg")).not.toBeNull();
    expect(screen.queryByText("Save the app log")).toBeNull();
  });

  it("keeps the subtitle while there is no error", () => {
    render(SettingsItem, { props: { title: "Export logs", subtitle: "Save the app log" } });

    expect(screen.getByText("Save the app log")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
