import { describe, expect, it } from "vitest";
import { getWinningTeam } from "./outcome";

describe("majority vote outcome", () => {
  it.each([
    [4, 3], [5, 3], [6, 4], [7, 4]
  ])("requires a strict majority for %i players", (players, required) => {
    const enough = Object.fromEntries(Array.from({ length: required }, (_, i) => [`v${i}`, "entity-player"]));
    const notEnough = Object.fromEntries(Array.from({ length: required - 1 }, (_, i) => [`v${i}`, "entity-player"]));
    expect(getWinningTeam("entity-player", enough, players)).toBe("guests");
    expect(getWinningTeam("entity-player", notEnough, players)).toBe("entity");
  });
  it("rejects unsupported party size", () => {
    expect(() => getWinningTeam("x", {}, 3)).toThrow();
  });
});
