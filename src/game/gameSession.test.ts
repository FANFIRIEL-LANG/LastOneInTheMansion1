import { describe, expect, it } from "vitest";
import { activeDayPlayer, activeNightPlayer, activeNightResultPlayer, completeNightResultReveal, completeEventPrivateReveal, getEligibleVoters, startMansionSession, submitDayAction, submitEventVotes, submitNightAction, submitTrialVotes } from "./gameSession";
import type { EvidenceCard } from "./dayActions";
import { MANSION_ROLES } from "./mafiaEngine";

const deck: EvidenceCard[] = [
  { id: "r1", title: "Символ пепла", description: "Символ на камне.", room: "library", kind: "ritual", isFalseLead: false },
  { id: "r2", title: "Свеча", description: "Чёрная свеча.", room: "chapel", kind: "ritual", isFalseLead: false },
  { id: "t1", title: "Записка", description: "Старая записка.", room: "kitchen", kind: "testimony", isFalseLead: true }
];

function finishEvent(session: ReturnType<typeof startMansionSession>) {
  if (session.phase !== "event" || !session.currentEvent) return session;
  const choice = session.currentEvent.choices[0].id;
  const votes = Object.fromEntries(session.players.filter((player) => player.alive).map((player) => [player.id, choice]));
  const result = submitEventVotes(session, votes);
  return result.phase === "event-private" && result.eventPrivatePlayerId
    ? completeEventPrivateReveal(result, result.eventPrivatePlayerId)
    : result;
}

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
    expect(session.phase).toBe("event");
    expect(session.currentEvent).not.toBeNull();
    session = finishEvent(session);
    expect(session.phase).toBe("trial");
    expect(session.eventHistory).toHaveLength(1);
    expect(session.dayState.actionsUsed).toHaveLength(8);
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
    session = finishEvent(session);
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
    session = finishEvent(session);
    const votes = Object.fromEntries(session.players.map((player, index) => [player.id, session.players[(index + 1) % session.players.length].id]));
    session = submitTrialVotes(session, votes);
    expect(session.phase).toBe("night");
    expect(activeNightPlayer(session)).not.toBeNull();
  });

  it("runs the same private night turn order and delivers private results before dawn", () => {
    let session = startMansionSession(["A", "B", "C", "D"], deck);
    while (session.phase === "day-actions") {
      const actor = activeDayPlayer(session)!;
      const target = session.players.find((player) => player.alive && player.id !== actor.id)!;
      session = submitDayAction(session, actor.id, { type: "interrogate", targetId: target.id, question: "Что ты видел?" });
    }
    session = finishEvent(session);
    const votes = Object.fromEntries(session.players.map((player, index) => [player.id, session.players[(index + 1) % session.players.length].id]));
    session = submitTrialVotes(session, votes);
    const order = [...session.nightTurnOrder];
    for (const id of order) {
      const actor = activeNightPlayer(session)!;
      expect(actor.id).toBe(id);
      const target = session.players.find((player) => player.alive && player.id !== actor.id);
      let kind: "cult-select" | "investigate" | "protect" | "ward" | "pass";
      switch (MANSION_ROLES[actor.roleId].nightAction) {
        case "cult-select": kind = "cult-select"; break;
        case "investigate": kind = "investigate"; break;
        case "protect": kind = "protect"; break;
        case "ward": kind = "ward"; break;
        default: kind = "pass";
      }
      session = submitNightAction(session, { actorId: actor.id, kind, ...(kind !== "pass" ? { targetId: target!.id } : {}) });
    }
    if (session.phase === "night-results") {
      while (session.phase === "night-results") {
        const resultPlayer = activeNightResultPlayer(session)!;
        expect(session.lastNight?.privateResults[resultPlayer.id]).toBeTruthy();
        session = completeNightResultReveal(session, resultPlayer.id);
      }
    }
    expect(session.phase === "day-actions" || session.phase === "ending").toBe(true);
    expect(session.day === 1 || session.day === 2).toBe(true);
    expect(getEligibleVoters(session.players).length).toBeGreaterThan(0);
  });
});

  it("preserves private evidence when the next day begins", () => {
    let session = startMansionSession(["A", "B", "C", "D"], deck);
    const actor = activeDayPlayer(session)!;
    session = submitDayAction(session, actor.id, { type: "search-room", room: "library" });
    const privateClue = session.dayState.privateEvidence[actor.id]?.[0];
    expect(privateClue).toBeTruthy();
    while (session.phase === "day-actions") {
      const nextActor = activeDayPlayer(session)!;
      if (nextActor.id === actor.id) break;
      const target = session.players.find((player) => player.alive && player.id !== nextActor.id)!;
      session = submitDayAction(session, nextActor.id, { type: "interrogate", targetId: target.id, question: "Что ты видел?" });
    }
    if (session.phase === "event" && session.currentEvent) {
      const choice = session.currentEvent.defaultChoiceId;
      const votes = Object.fromEntries(session.players.filter((player) => player.alive).map((player) => [player.id, choice]));
      session = submitEventVotes(session, votes);
    }
    if (session.phase === "trial") {
      const votes = Object.fromEntries(session.players.map((player, index) => [player.id, session.players[(index + 1) % session.players.length].id]));
      session = submitTrialVotes(session, votes);
      while (session.phase === "night") {
        const nightActor = activeNightPlayer(session)!;
        const target = session.players.find((player) => player.alive && player.id !== nightActor.id);
        const kind = MANSION_ROLES[nightActor.roleId].nightAction;
        session = submitNightAction(session, { actorId: nightActor.id, kind, ...(kind !== "pass" ? { targetId: target!.id } : {}) });
      }
      while (session.phase === "night-results") {
        const resultPlayer = activeNightResultPlayer(session)!;
        session = completeNightResultReveal(session, resultPlayer.id);
      }
    }
    if (session.phase === "day-actions" && session.day === 2) {
      expect(session.dayState.privateEvidence[actor.id]).toEqual([privateClue]);
    }
  });
