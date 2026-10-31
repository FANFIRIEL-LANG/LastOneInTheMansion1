import { describe, expect, it } from "vitest";
import { activeDayPlayer, activeNightPlayer, getEligibleVoters, startMansionSession, submitDayAction, submitNightAction, submitTrialVotes } from "./gameSession";
import type { EvidenceCard } from "./dayActions";
import { MANSION_ROLES } from "./mafiaEngine";

const deck: EvidenceCard[] = [
  { id: "r1", title: "Символ пепла", description: "Символ на камне.", room: "library", kind: "ritual", isFalseLead: false },
  { id: "r2", title: "Свеча", description: "Чёрная свеча.", room: "chapel", kind: "ritual", isFalseLead: false },
  { id: "t1", title: "Записка", description: "Старая записка.", room: "kitchen", kind: "testimony", isFalseLead: true }
];

describe("Mafia game session state machine", () => {
  it("starts a four-player game in the public day-action phase", () => {
    const session = startMansionSession(["A", "B", "C", "D"], deck);
    expect(session.phase).toBe("day-actions");
    expect(session.day).toBe(1);
    expect(activeDayPlayer(session)).not.toBeNull();
  });

  it("gives each living player one public action before the trial", () => {
    let session = startMansionSession(["A", "B", "C", "D"], deck);
    while (session.phase === "day-actions") {
      const actor = activeDayPlayer(session)!;
      const target = session.players.find((player) => player.alive && player.id !== actor.id)!;
      session = submitDayAction(session, actor.id, { type: "interrogate", targetId: target.id, question: "Что ты видел?" });
    }
    expect(session.phase).toBe("trial");
    expect(session.dayState.actionsUsed).toHaveLength(4);
    expect(() => submitDayAction(session, "p1", { type: "accuse", targetId: "p2" })).toThrow();
  });

  it("rejects a public action submitted out of turn", () => {
    const session = startMansionSession(["A", "B", "C", "D"], deck);
    expect(() => submitDayAction(session, "p4", { type: "search-room", room: "library" })).toThrow();
  });

  it("requires all eligible voters to submit one secret vote", () => {
    let session = startMansionSession(["A", "B", "C", "D"], deck);
    while (session.phase === "day-actions") {
      const actor = activeDayPlayer(session)!;
      const target = session.players.find((player) => player.alive && player.id !== actor.id)!;
      session = submitDayAction(session, actor.id, { type: "interrogate", targetId: target.id, question: "Где ты был?" });
    }
    expect(() => submitTrialVotes(session, { p1: "p2" })).toThrow();
    expect(session.phase).toBe("trial");
  });

  it("moves from trial to night when the vote does not end the game", () => {
    let session = startMansionSession(["A", "B", "C", "D"], deck);
    while (session.phase === "day-actions") {
      const actor = activeDayPlayer(session)!;
      const target = session.players.find((player) => player.alive && player.id !== actor.id)!;
      session = submitDayAction(session, actor.id, { type: "interrogate", targetId: target.id, question: "Что произошло?" });
    }
    const votes = Object.fromEntries(session.players.map((player, index) => [player.id, session.players[(index + 1) % session.players.length].id]));
    session = submitTrialVotes(session, votes);
    expect(session.phase).toBe("night");
    expect(activeNightPlayer(session)).not.toBeNull();
  });

  it("runs the same private night turn order for every player, including a neutral resident turn", () => {
    let session = startMansionSession(["A", "B", "C", "D"], deck);
    while (session.phase === "day-actions") {
      const actor = activeDayPlayer(session)!;
      const target = session.players.find((player) => player.alive && player.id !== actor.id)!;
      session = submitDayAction(session, actor.id, { type: "interrogate", targetId: target.id, question: "Что ты видел?" });
    }
    const votes = Object.fromEntries(session.players.map((player, index) => [player.id, session.players[(index + 1) % session.players.length].id]));
    session = submitTrialVotes(session, votes);
    const order = [...session.nightTurnOrder];
    for (const id of order) {
      const actor = activeNightPlayer(session)!;
      expect(actor.id).toBe(id);
      const target = session.players.find((player) => player.alive && player.id !== actor.id);
      let kind: "cult-select" | "investigate" | "protect" | "ward" | "commune" | "listen" | "pass";
      switch (MANSION_ROLES[actor.roleId].nightAction) {
        case "cult-select": kind = "cult-select"; break;
        case "investigate": kind = "investigate"; break;
        case "protect": kind = "protect"; break;
        case "ward": kind = "ward"; break;
        case "commune": kind = "commune"; break;
        case "listen": kind = "listen"; break;
        default: kind = "pass";
      }
      session = submitNightAction(session, { actorId: actor.id, kind, ...(kind !== "pass" && kind !== "commune" && kind !== "listen" ? { targetId: target!.id } : {}) });
    }
    expect(session.phase === "day-actions" || session.phase === "ending").toBe(true);
    expect(session.day === 1 || session.day === 2).toBe(true);
    expect(getEligibleVoters(session.players).length).toBeGreaterThan(0);
  });
});
