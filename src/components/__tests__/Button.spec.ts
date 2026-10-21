import { describe, expect, it } from "vitest";

import { renderWithPlugins, screen } from "@/test/utils";
import Button from "../ui/button/Button.vue";

describe("Button", () => {
  it("renders correctly", () => {
    renderWithPlugins(Button, {
      slots: {
        default: "Click me",
      },
    });

    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("fills a solid button with its colour's tone", () => {
    renderWithPlugins(Button, {
      props: {
        color: "destructive",
      },
      slots: {
        default: "Delete",
      },
    });

    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-color", "destructive");
    expect(button).toHaveClass("bg-tone");
  });

  it("is disabled when prop is passed", () => {
    renderWithPlugins(Button, {
      props: {
        disabled: true,
      },
      slots: {
        default: "Disabled",
      },
    });

    expect(screen.getByRole("button")).toBeDisabled();
  });
});
