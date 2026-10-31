import { describe, expect, it } from "vitest";
import { assignRoles } from "./roles";

describe("role assignment", () => {
  it.each([4, 5, 6, 7])("assigns exactly %i distinct roles", (count) => {
    const result = assignRoles(Array.from({ length: count }, (_, i) => `P${i}`));
    expect(result).toHaveLength(count);
    expect(new Set(result.map((role) => role.id)).size).toBe(count);
    expect(result.filter((role) => role.team === "entity")).toHaveLength(1);
  });
  it("rejects an unsupported number of players", () => {
    expect(() => assignRoles(["A", "B", "C"])).toThrow();
  });
});
