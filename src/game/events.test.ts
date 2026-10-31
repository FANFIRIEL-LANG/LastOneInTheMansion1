import { describe, expect, it } from "vitest";
import { MANSION_EVENT_DECK, resolveMansionEvent } from "./events";
import { createDayState, type EvidenceCard } from "./dayActions";
import type { MansionPlayer } from "./mafiaEngine";

const players: MansionPlayer[] = [
  { id: "p1", name: "A", roleId: "detective", alive: true, wounds: 0, ghostVoteAvailable: false },
  { id: "p2", name: "B", roleId: "cultist", alive: true, wounds: 0, ghostVoteAvailable: false },
  { id: "p3", name: "C", roleId: "doctor", alive: true, wounds: 0, ghostVoteAvailable: false },
  { id: "p4", name: "D", roleId: "medium", alive: true, wounds: 0, ghostVoteAvailable: false }
];
const clues: EvidenceCard[] = [
  { id: "r1", title: "Пепельный знак", description: "Знак на камне.", room: "library", kind: "ritual", isFalseLead: false },
  { id: "t1", title: "Записка", description: "Записка на столе.", room: "kitchen", kind: "testimony", isFalseLead: false }
];

describe("Mansion events", () => {
  it("requires every living player to vote on the public event", () => {
    expect(() => resolveMansionEvent(players, createDayState(clues), MANSION_EVENT_DECK[0], { p1: "feed-ritual" })).toThrow();
  });

  it("applies the majority choice and changes ritual progress", () => {
    const state = createDayState(clues, 1);
    const result = resolveMansionEvent(players, state, MANSION_EVENT_DECK[0], {
      p1: "feed-ritual", p2: "feed-ritual", p3: "feed-ritual", p4: "resist-ritual"
    });
    expect(result.chosenChoiceId).toBe("feed-ritual");
    expect(result.state.ritualProgress).toBe(2);
  });

  it("uses the event's default choice when the vote is tied", () => {
    const result = resolveMansionEvent(players, createDayState(clues), MANSION_EVENT_DECK[0], {
      p1: "resist-ritual", p2: "resist-ritual", p3: "feed-ritual", p4: "feed-ritual"
    });
    expect(result.chosenChoiceId).toBe("feed-ritual");
    expect(result.state.ritualProgress).toBe(1);
  });

  it("lets the group spend a public ritual clue to slow the ritual", () => {
    const state = createDayState(clues, 2);
    state.publicEvidence = [clues[0]];
    const result = resolveMansionEvent(players, state, MANSION_EVENT_DECK[0], {
      p1: "resist-ritual", p2: "resist-ritual", p3: "resist-ritual", p4: "feed-ritual"
    });
    expect(result.state.ritualProgress).toBe(1);
    expect(result.state.publicEvidence).toHaveLength(0);
  });

  it("reveals a clue publicly when the group opens the basement", () => {
    const result = resolveMansionEvent(players, createDayState(clues), MANSION_EVENT_DECK[1], {
      p1: "open-basement", p2: "open-basement", p3: "open-basement", p4: "seal-basement"
    });
    expect(result.state.publicEvidence).toEqual([clues[0]]);
    expect(result.state.clueDeck).toEqual([clues[1]]);
  });

  it("gives the medium a private omen without exposing it publicly", () => {
    const result = resolveMansionEvent(players, createDayState(clues, 3), MANSION_EVENT_DECK[2], {
      p1: "listen-portrait", p2: "listen-portrait", p3: "listen-portrait", p4: "burn-portrait"
    });
    expect(result.privateResults.p4).toContain("почти завершён");
    expect(result.publicMessage).not.toContain("почти завершён");
  });
});
