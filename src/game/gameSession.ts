import {
  createMansionPlayers,
  getMansionVictory,
  resolveNight,
  resolveVote,
  type MansionPlayer,
  type NightAction,
  type NightResolution,
  type Victory
} from "./mafiaEngine";
import {
  createDayState,
  resolvePublicAction,
  type DayState,
  type EvidenceCard,
  type PublicAction
} from "./dayActions";
import { resolveMansionEvent, shuffleEvents, type MansionEvent, type MansionEventChoiceId } from "./events";

export type SessionPhase = "day-actions" | "event" | "event-private" | "trial" | "night" | "night-results" | "ending";

export interface MansionSession {
  players: MansionPlayer[];
  day: number;
  phase: SessionPhase;
  ritualProgress: number;
  dayState: DayState;
  eventDeck: MansionEvent[];
  currentEvent: MansionEvent | null;
  eventHistory: Array<{ eventId: string; choiceId: MansionEventChoiceId }>;
  lastEventPrivateResults: Record<string, string>;
  eventPrivatePlayerId: string | null;
  nightTurnOrder: string[];
  nightActionIndex: number;
  nightActions: NightAction[];
  nightResultOrder: string[];
  nightResultIndex: number;
  lastNight: NightResolution | null;
  winner: Victory;
  lastPublicMessage: string;
}

export function startMansionSession(names: string[], clueDeck: EvidenceCard[]): MansionSession {
  const players = createMansionPlayers(names);
  const ritualProgress = 0;
  return {
    players,
    day: 1,
    phase: "day-actions",
    ritualProgress,
    dayState: createDayState(clueDeck, ritualProgress, 1),
    eventDeck: shuffleEvents(),
    currentEvent: null,
    eventHistory: [],
    lastEventPrivateResults: {},
    eventPrivatePlayerId: null,
    nightTurnOrder: [],
    nightActionIndex: 0,
    nightActions: [],
    nightResultOrder: [],
    nightResultIndex: 0,
    lastNight: null,
    winner: null,
    lastPublicMessage: ""
  };
}

export function activeDayPlayer(session: MansionSession): MansionPlayer | null {
  if (session.phase !== "day-actions") return null;
  return session.players.find((player) => player.alive && !session.dayState.actionsUsed.includes(player.id)) ?? null;
}

export function activeNightPlayer(session: MansionSession): MansionPlayer | null {
  if (session.phase !== "night") return null;
  const id = session.nightTurnOrder[session.nightActionIndex];
  return session.players.find((player) => player.id === id) ?? null;
}

export function submitDayAction(session: MansionSession, actorId: string, action: PublicAction): MansionSession {
  const actor = activeDayPlayer(session);
  if (!actor || actor.id !== actorId) throw new Error("Сейчас ход другого игрока.");
  const result = resolvePublicAction(session.players, session.dayState, actorId, action);
  const next: MansionSession = { ...session, dayState: result.state, lastPublicMessage: result.message };
  if (!activeDayPlayer(next)) {
    const drawn = drawNextEvent(next.eventDeck);
    next.phase = "event";
    next.currentEvent = drawn.event;
    next.eventDeck = drawn.remaining;
  }
  return next;
}

export function submitEventVotes(session: MansionSession, votes: Record<string, MansionEventChoiceId>): MansionSession {
  if (session.phase !== "event" || !session.currentEvent) throw new Error("Сейчас нет события для голосования.");
  const result = resolveMansionEvent(session.players, session.dayState, session.currentEvent, votes);
  const eventHistory = [...session.eventHistory, { eventId: session.currentEvent.id, choiceId: result.chosenChoiceId }];
  const winner = getMansionVictory(session.players, result.state.ritualProgress);
  const privatePlayerId = Object.keys(result.privateResults)[0] ?? null;
  if (winner) {
    return {
      ...session,
      dayState: result.state,
      ritualProgress: result.state.ritualProgress,
      currentEvent: null,
      eventHistory,
      lastEventPrivateResults: result.privateResults,
      eventPrivatePlayerId: null,
      phase: "ending",
      winner,
      lastPublicMessage: result.publicMessage
    };
  }
  return {
    ...session,
    dayState: result.state,
    ritualProgress: result.state.ritualProgress,
    currentEvent: null,
    eventHistory,
    lastEventPrivateResults: result.privateResults,
    eventPrivatePlayerId: privatePlayerId,
    phase: privatePlayerId ? "event-private" : "trial",
    lastPublicMessage: result.publicMessage
  };
}

export function completeEventPrivateReveal(session: MansionSession, playerId: string): MansionSession {
  if (session.phase !== "event-private" || session.eventPrivatePlayerId !== playerId) {
    throw new Error("Эта личная подсказка предназначена другому игроку.");
  }
  return {
    ...session,
    phase: "trial",
    eventPrivatePlayerId: null
  };
}

export function submitTrialVotes(session: MansionSession, votes: Record<string, string>): MansionSession {
  if (session.phase !== "trial") throw new Error("Сейчас не время голосования.");
  const result = resolveVote(session.players, votes);
  const winner = getMansionVictory(result.players, session.ritualProgress);
  if (winner) {
    return { ...session, players: result.players, phase: "ending", winner, lastPublicMessage: result.banishedPlayerId ? "Игрок изгнан. Игра окончена." : "Голосование завершено. Игра окончена." };
  }
  return {
    ...session,
    players: result.players,
    phase: "night",
    nightTurnOrder: session.players.map((player) => player.id),
    nightActionIndex: 0,
    nightActions: [],
    lastPublicMessage: result.banishedPlayerId ? "Изгнание состоялось. Особняк погружается во тьму." : "Никого не изгнали. Наступает ночь."
  };
}

export function activeNightResultPlayer(session: MansionSession): MansionPlayer | null {
  if (session.phase !== "night-results") return null;
  const id = session.nightResultOrder[session.nightResultIndex];
  return session.players.find((player) => player.id === id) ?? null;
}

export function completeNightResultReveal(session: MansionSession, playerId: string): MansionSession {
  const active = activeNightResultPlayer(session);
  if (!active || active.id !== playerId) throw new Error("Эта ночная информация предназначена другому игроку.");
  const nextIndex = session.nightResultIndex + 1;
  if (nextIndex < session.nightResultOrder.length) return { ...session, nightResultIndex: nextIndex };
  return advanceToNextDay(session);
}

export function submitNightAction(session: MansionSession, action: NightAction): MansionSession {
  if (session.phase !== "night") throw new Error("Сейчас не ночная фаза.");
  const actor = activeNightPlayer(session);
  if (!actor || actor.id !== action.actorId) throw new Error("Сейчас ход другого игрока.");
  if (!actor.alive && action.kind !== "pass") throw new Error("Призрак больше не использует способность.");
  if (actor.alive && action.kind === "pass" && actor.roleId !== "resident") {
    throw new Error("Живой игрок должен выполнить свою ночную способность.");
  }

  const collected = [...session.nightActions, action];
  const nextIndex = session.nightActionIndex + 1;
  if (nextIndex < session.nightTurnOrder.length) {
    return { ...session, nightActions: collected, nightActionIndex: nextIndex };
  }

  const livingActions = collected.filter((item) => session.players.some((player) => player.id === item.actorId && player.alive));
  const resolution = resolveNight(session.players, livingActions, session.ritualProgress, session.dayState.publicGuardedPlayerId);
  const winner = getMansionVictory(resolution.players, resolution.ritualProgress);
  if (winner) {
    return {
      ...session,
      players: resolution.players,
      ritualProgress: resolution.ritualProgress,
      lastNight: resolution,
      phase: "ending",
      winner,
      nightActions: collected,
      nightActionIndex: nextIndex,
      lastPublicMessage: "Рассвет принёс окончательный ответ. Игра завершена."
    };
  }

  const resultPlayers = resolution.players;
  const privatePlayerIds = Object.keys(resolution.privateResults);
  const base: MansionSession = {
    ...session,
    players: resultPlayers,
    ritualProgress: resolution.ritualProgress,
    nightActions: collected,
    lastNight: resolution,
    nightResultOrder: privatePlayerIds,
    nightResultIndex: 0,
    winner: null,
    lastPublicMessage: "Ночь закончилась. Наступает новый день."
  };
  if (privatePlayerIds.length > 0) return { ...base, phase: "night-results" };
  return advanceToNextDay(base);
}

function advanceToNextDay(session: MansionSession): MansionSession {
  const nextDay = session.day + 1;
  const dayState = createDayState(session.dayState.clueDeck, session.ritualProgress, nextDay);
  dayState.privateEvidence = Object.fromEntries(Object.entries(session.dayState.privateEvidence).map(([id, cards]) => [id, [...cards]]));
  dayState.publicEvidence = [...session.dayState.publicEvidence];
  return {
    ...session,
    day: nextDay,
    phase: "day-actions",
    dayState,
    nightTurnOrder: [],
    nightActionIndex: 0,
    nightActions: [],
    nightResultOrder: [],
    nightResultIndex: 0,
    lastPublicMessage: "Наступает новый день. Особняк хранит ещё больше тайн."
  };
}

export function getEligibleVoters(players: MansionPlayer[]): string[] {
  return players.filter((player) => player.alive || player.ghostVoteAvailable).map((player) => player.id);
}

function drawNextEvent(deck: MansionEvent[]): { event: MansionEvent; remaining: MansionEvent[] } {
  const available = deck.length > 0 ? [...deck] : shuffleEvents();
  const [event, ...remaining] = available;
  return { event, remaining };
}
