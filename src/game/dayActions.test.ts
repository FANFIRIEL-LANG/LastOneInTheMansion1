import { describe, expect, it } from "vitest";
import { createDayState, resolvePublicAction, type EvidenceCard } from "./dayActions";
import type { MansionPlayer } from "./mafiaEngine";

const players: MansionPlayer[] = [
  { id: "p1", name: "Аня", roleId: "detective", alive: true, wounds: 0, ghostVoteAvailable: false },
  { id: "p2", name: "Борис", roleId: "cultist", alive: true, wounds: 0, ghostVoteAvailable: false },
  { id: "p3", name: "Вика", roleId: "doctor", alive: true, wounds: 0, ghostVoteAvailable: false },
  { id: "p4", name: "Глеб", roleId: "resident", alive: true, wounds: 0, ghostVoteAvailable: false }
];

const clues: EvidenceCard[] = [
  { id: "c1", title: "Пепельный знак", description: "Знак выжжен на столе.", room: "library", kind: "ritual", isFalseLead: false },
  { id: "c2", title: "Чёрная свеча", description: "Свеча пахнет землёй.", room: "chapel", kind: "ritual", isFalseLead: false },
  { id: "c3", title: "Старая записка", description: "Кто-то оставил записку.", room: "kitchen", kind: "testimony", isFalseLead: true }
];

describe("public day actions", () => {
  it("lets a player search a room and keeps the found clue private", () => {
    const result = resolvePublicAction(players, createDayState(clues), "p1", { type: "search-room", room: "library" });
    expect(result.foundEvidence?.id).toBe("c1");
    expect(result.state.privateEvidence.p1).toEqual([clues[0]]);
    expect(result.state.publicEvidence).toHaveLength(0);
  });

  it("makes shared evidence public and removes it from the player's private inventory", () => {
    const searched = resolvePublicAction(players, createDayState(clues), "p1", { type: "search-room", room: "library" });
    const shared = resolvePublicAction(players, searched.state, "p1", { type: "share-evidence", evidenceId: "c1" });
    expect(shared.state.publicEvidence).toEqual([clues[0]]);
    expect(shared.state.privateEvidence.p1).toEqual([]);
  });

  it("prevents a player from taking more than one public action per day", () => {
    const searched = resolvePublicAction(players, createDayState(clues), "p1", { type: "search-room", room: "library" });
    expect(() => resolvePublicAction(players, searched.state, "p1", { type: "accuse", targetId: "p2" })).toThrow();
  });

  it("allows a public interrogation while making clear the target may lie", () => {
    const result = resolvePublicAction(players, createDayState(clues), "p1", { type: "interrogate", targetId: "p2", question: "Где ты был ночью?" });
    expect(result.state.interrogations[0]).toEqual({ askerId: "p1", targetId: "p2", question: "Где ты был ночью?" });
    expect(result.message).toContain("может солгать");
  });

  it("requires two public ritual clues to reduce ritual progress", () => {
    const state = createDayState(clues, 3);
    state.publicEvidence = [clues[0], clues[1]];
    const result = resolvePublicAction(players, state, "p4", { type: "study-ritual", evidenceIds: ["c1", "c2"] });
    expect(result.state.ritualProgress).toBe(2);
    expect(result.state.publicEvidence).toHaveLength(0);
  });

  it("rejects studying with a false/non-ritual clue", () => {
    const state = createDayState(clues, 3);
    state.publicEvidence = [clues[0], clues[2]];
    expect(() => resolvePublicAction(players, state, "p4", { type: "study-ritual", evidenceIds: ["c1", "c3"] })).toThrow();
  });

  it("records accusations for the trial", () => {
    const result = resolvePublicAction(players, createDayState(clues), "p1", { type: "accuse", targetId: "p2" });
    expect(result.state.nominations).toEqual(["p2"]);
  });

  it("does not allow a ghost or an already-used player to take a public action", () => {
    const ghostPlayers = players.map((player) => player.id === "p1" ? { ...player, alive: false, ghostVoteAvailable: true } : player);
    expect(() => resolvePublicAction(ghostPlayers, createDayState(clues), "p1", { type: "search-room", room: "library" })).toThrow();
  });
});
