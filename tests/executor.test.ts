import { describe, it, expect } from "vitest";
import { resolveActions } from "../src/executor.js";
import type { Rule } from "../src/config.js";

describe("resolveActions", () => {
  const rules: Rule[] = [
    { name: "newsletters", description: "d", actions: [{ action: "move", target: "Newsletters" }] },
    { name: "receipts", description: "d", actions: [{ action: "move", target: "Receipts" }, { action: "mark_read" }] },
    { name: "important", description: "d", actions: [{ action: "flag" }] },
  ];

  it("collects all actions from matched rules", () => {
    const actions = resolveActions(["newsletters", "important"], rules);
    expect(actions).toContainEqual({ action: "move", target: "Newsletters" });
    expect(actions).toContainEqual({ action: "flag" });
  });

  it("last move wins when multiple moves match", () => {
    const actions = resolveActions(["newsletters", "receipts"], rules);
    const moves = actions.filter((a) => a.action === "move");
    expect(moves).toHaveLength(1);
    expect(moves[0].target).toBe("Receipts");
  });

  it("non-move actions from all rules are preserved", () => {
    const actions = resolveActions(["receipts", "important"], rules);
    expect(actions).toContainEqual({ action: "mark_read" });
    expect(actions).toContainEqual({ action: "flag" });
  });

  it("returns empty for no matches", () => {
    const actions = resolveActions([], rules);
    expect(actions).toEqual([]);
  });

  it("returns empty for unknown rule names", () => {
    const actions = resolveActions(["nonexistent"], rules);
    expect(actions).toEqual([]);
  });
});
