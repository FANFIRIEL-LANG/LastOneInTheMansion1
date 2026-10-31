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

export type SessionPhase = "day-actions" | "trial" | "night" | "ending";

export interface MansionSession {
  players: MansionPlayer[];
  day: number;
  phase: SessionPhase;
  ritualProgress: number;
  dayState: DayState;
  nightTurnOrder: string[];
  nightActionIndex: number;
  nightActions: NightAction[];
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
    nightTurnOrder: [],
    nightActionIndex: 0,
    nightActions: [],
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
    next.phase = "trial";
  }
  return next;
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

export function submitNightAction(session: MansionSession, action: NightAction): MansionSession {
  if (session.phase !== "night") throw new Error("Сейчас не ночная фаза.");
  const actor = activeNightPlayer(session);
  if (!actor || actor.id !== action.actorId) throw new Error("Сейчас ход другого игрока.");
  if (!actor.alive && action.kind !== "pass") throw new Error("Призрак больше не использует способность.");
  if (actor.alive && action.kind === "pass" && actor.roleId !== "resident") {
    throw new Error("У этой роли есть ночная способность.");
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

  const nextDay = session.day + 1;
  return {
    ...session,
    players: resolution.players,
    ritualProgress: resolution.ritualProgress,
    day: nextDay,
    phase: "day-actions",
    dayState: createDayState(session.dayState.clueDeck, resolution.ritualProgress, nextDay),
    nightTurnOrder: [],
    nightActionIndex: 0,
    nightActions: [],
    lastNight: resolution,
    winner: null,
    lastPublicMessage: "Наступает новый день. Особняк хранит ещё больше тайн."
  };
}

export function getEligibleVoters(players: MansionPlayer[]): string[] {
  return players.filter((player) => player.alive || player.ghostVoteAvailable).map((player) => player.id);
}
