import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fullPlayerGhostHover } from "../ghost-button";

describe("fullPlayerGhostHover", () => {
  const merged = cn(buttonVariants({ variant: "ghost", size: "icon-lg" }), fullPlayerGhostHover);

  it("replaces both of the ghost variant's hover fills", () => {
    expect(merged).not.toContain("hover:bg-accent");
    expect(merged).not.toContain("dark:hover:bg-accent/50");
    expect(merged).toContain("hover:bg-foreground/10");
    expect(merged).toContain("dark:hover:bg-foreground/10");
  });

  it("replaces the ghost variant's hover text colour", () => {
    expect(merged).not.toContain("hover:text-accent-foreground");
    expect(merged).toContain("hover:text-foreground");
  });
});
