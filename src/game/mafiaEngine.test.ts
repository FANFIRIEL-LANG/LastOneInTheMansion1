import { describe, expect, it } from "vitest";
import {
  createMansionPlayers,
  getMansionVictory,
  MANSION_ROLES,
  resolveNight,
  resolveVote,
  roleSetForPlayerCount,
  type MansionPlayer,
  type NightAction
} from "./mafiaEngine";

function playersFor(roles: MansionPlayer["roleId"][]): MansionPlayer[] {
  return roles.map((roleId, index) => ({
    id: `p${index + 1}`,
    name: `Игрок ${index + 1}`,
    roleId,
    alive: true,
    wounds: 0,
    ghostVoteAvailable: false
  }));
}

describe("Mafia Halloween role balance", () => {
  it.each([[4, 1, 3], [5, 1, 4], [6, 2, 4], [7, 2, 5]])(
    "creates a valid %i-player roster",
    (count, cultCount, guestCount) => {
      const roles = roleSetForPlayerCount(count);
      expect(roles).toHaveLength(count);
      expect(roles.filter((id) => MANSION_ROLES[id].faction === "cult")).toHaveLength(cultCount);
      expect(roles.filter((id) => MANSION_ROLES[id].faction === "guests")).toHaveLength(guestCount);
    }
  );

  it("deals unique roles and normalizes blank player names", () => {
    const players = createMansionPlayers(["Аня", "", "Вася", "Дима"]);
    expect(players).toHaveLength(4);
    expect(new Set(players.map((player) => player.roleId)).size).toBe(4);
    expect(players[1].name).toBe("Игрок 2");
  });

  it("rejects unsupported player counts", () => {
    expect(() => roleSetForPlayerCount(3)).toThrow();
    expect(() => roleSetForPlayerCount(8)).toThrow();
  });
});

describe("private night resolution", () => {
  it("requires a meaningful private turn for every living player, including residents", () => {
    const players = playersFor(["cultist", "detective", "doctor", "resident"]);
    const actions: NightAction[] = [
      { actorId: "p1", kind: "cult-select", targetId: "p4" },
      { actorId: "p2", kind: "investigate", targetId: "p1" },
      { actorId: "p3", kind: "protect", targetId: "p4" },
      { actorId: "p4", kind: "listen" }
    ];
    expect(resolveNight(players, actions, 0).attackBlocked).toBe(true);
    expect(resolveNight(players, actions, 0).ritualProgress).toBe(0);
  });

  it("keeps investigation and listening results private to the acting player", () => {
    const players = playersFor(["cultist", "detective", "doctor", "resident"]);
    const actions: NightAction[] = [
      { actorId: "p1", kind: "cult-select", targetId: "p4" },
      { actorId: "p2", kind: "investigate", targetId: "p1" },
      { actorId: "p3", kind: "protect", targetId: "p3" },
      { actorId: "p4", kind: "listen" }
    ];
    const result = resolveNight(players, actions, 0);
    expect(result.privateResults.p2).toContain("культом");
    expect(result.privateResults.p4).toContain("Особняк затих");
    expect(Object.keys(result.privateResults).sort()).toEqual(["p2", "p3", "p4"]);
  });

  it("adds a wound and ritual progress when an unprotected target is attacked", () => {
    const players = playersFor(["cultist", "detective", "doctor", "resident"]);
    const actions: NightAction[] = [
      { actorId: "p1", kind: "cult-select", targetId: "p4" },
      { actorId: "p2", kind: "investigate", targetId: "p1" },
      { actorId: "p3", kind: "protect", targetId: "p3" },
      { actorId: "p4", kind: "listen" }
    ];
    const result = resolveNight(players, actions, 1);
    expect(result.players.find((player) => player.id === "p4")?.wounds).toBe(1);
    expect(result.ritualProgress).toBe(2);
    expect(result.attackedPlayerId).toBe("p4");
  });

  it("applies the public day protection during the following night", () => {
    const players = playersFor(["cultist", "detective", "doctor", "resident"]);
    const actions: NightAction[] = [
      { actorId: "p1", kind: "cult-select", targetId: "p4" },
      { actorId: "p2", kind: "investigate", targetId: "p1" },
      { actorId: "p3", kind: "protect", targetId: "p3" },
      { actorId: "p4", kind: "listen" }
    ];
    const result = resolveNight(players, actions, 0, "p4");
    expect(result.attackBlocked).toBe(true);
    expect(result.players[3].wounds).toBe(0);
  });

  it("turns a player into a ghost after two wounds and grants one final vote", () => {
    const players = playersFor(["cultist", "detective", "doctor", "resident"]);
    players[3].wounds = 1;
    const actions: NightAction[] = [
      { actorId: "p1", kind: "cult-select", targetId: "p4" },
      { actorId: "p2", kind: "investigate", targetId: "p1" },
      { actorId: "p3", kind: "protect", targetId: "p3" },
      { actorId: "p4", kind: "listen" }
    ];
    const result = resolveNight(players, actions, 0);
    expect(result.players[3].alive).toBe(false);
    expect(result.players[3].ghostVoteAvailable).toBe(true);
  });

  it("fails a tied cult target choice", () => {
    const players = playersFor(["cultist", "acolyte", "detective", "doctor", "medium", "guardian"]);
    const actions: NightAction[] = [
      { actorId: "p1", kind: "cult-select", targetId: "p3" },
      { actorId: "p2", kind: "cult-select", targetId: "p4" },
      { actorId: "p3", kind: "investigate", targetId: "p1" },
      { actorId: "p4", kind: "protect", targetId: "p5" },
      { actorId: "p5", kind: "commune" },
      { actorId: "p6", kind: "ward", targetId: "p3" }
    ];
    const result = resolveNight(players, actions, 0);
    expect(result.attackedPlayerId).toBeNull();
    expect(result.ritualProgress).toBe(0);
  });

  it("rejects an action that does not match the player's role", () => {
    const players = playersFor(["cultist", "detective", "doctor", "resident"]);
    const actions: NightAction[] = [
      { actorId: "p1", kind: "cult-select", targetId: "p4" },
      { actorId: "p2", kind: "protect", targetId: "p1" },
      { actorId: "p3", kind: "protect", targetId: "p4" },
      { actorId: "p4", kind: "listen" }
    ];
    expect(() => resolveNight(players, actions, 0)).toThrow();
  });
});

describe("secret trial voting and victory", () => {
  it("requires a strict majority to banish a player", () => {
    const players = playersFor(["cultist", "detective", "doctor", "resident"]);
    const result = resolveVote(players, { p1: "p2", p2: "p1", p3: "p1", p4: "p1" });
    expect(result.banishedPlayerId).toBe("p1");
    expect(result.players[0].alive).toBe(false);
    expect(result.players[0].ghostVoteAvailable).toBe(true);
  });

  it("does not banish on a tie", () => {
    const players = playersFor(["cultist", "detective", "doctor", "resident"]);
    const result = resolveVote(players, { p1: "p2", p2: "p1", p3: "p1", p4: "p2" });
    expect(result.banishedPlayerId).toBeNull();
  });

  it("allows a ghost to cast one final vote, then consumes it", () => {
    const players = playersFor(["cultist", "detective", "doctor", "resident"]);
    players[3].alive = false;
    players[3].ghostVoteAvailable = true;
    const result = resolveVote(players, { p1: "p2", p2: "p1", p3: "p1", p4: "p1" });
    expect(result.players[3].ghostVoteAvailable).toBe(false);
  });

  it("ends for guests when the last cult member is banished", () => {
    const players = playersFor(["cultist", "detective", "doctor", "resident"]);
    players[0].alive = false;
    expect(getMansionVictory(players, 0)).toBe("guests");
  });

  it("ends for the cult when ritual is complete or cult reaches parity", () => {
    const players = playersFor(["cultist", "acolyte", "detective", "doctor", "medium", "guardian"]);
    expect(getMansionVictory(players, 5)).toBe("cult");
    players[2].alive = false;
    players[3].alive = false;
    expect(getMansionVictory(players, 0)).toBe("cult");
  });

  it("continues while both sides still have a chance", () => {
    const players = playersFor(["cultist", "detective", "doctor", "resident"]);
    expect(getMansionVictory(players, 1)).toBeNull();
  });
});
