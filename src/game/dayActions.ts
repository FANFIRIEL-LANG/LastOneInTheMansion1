import type { MansionPlayer } from "./mafiaEngine";

export type MansionRoom = "library" | "chapel" | "kitchen" | "observatory" | "basement";
export type EvidenceKind = "ritual" | "testimony" | "trace";

export interface EvidenceCard {
  id: string;
  title: string;
  description: string;
  room: MansionRoom;
  kind: EvidenceKind;
  isFalseLead: boolean;
}

export interface Interrogation {
  askerId: string;
  targetId: string;
  question: string;
}

export interface DayState {
  day: number;
  ritualProgress: number;
  actionsUsed: string[];
  clueDeck: EvidenceCard[];
  privateEvidence: Record<string, EvidenceCard[]>;
  publicEvidence: EvidenceCard[];
  interrogations: Interrogation[];
  nominations: string[];
  publicLog: string[];
}

export type PublicAction =
  | { type: "search-room"; room: MansionRoom }
  | { type: "interrogate"; targetId: string; question: string }
  | { type: "share-evidence"; evidenceId: string }
  | { type: "study-ritual"; evidenceIds: [string, string] }
  | { type: "accuse"; targetId: string };

export interface DayActionResult {
  state: DayState;
  message: string;
  foundEvidence?: EvidenceCard;
}

export function createDayState(clueDeck: EvidenceCard[], ritualProgress = 0, day = 1): DayState {
  return {
    day,
    ritualProgress,
    actionsUsed: [],
    clueDeck: [...clueDeck],
    privateEvidence: {},
    publicEvidence: [],
    interrogations: [],
    nominations: [],
    publicLog: []
  };
}

/** Each living player gets exactly one public action per day. */
export function resolvePublicAction(
  players: MansionPlayer[],
  state: DayState,
  actorId: string,
  action: PublicAction
): DayActionResult {
  const actor = players.find((player) => player.id === actorId && player.alive);
  if (!actor) throw new Error("Публичное действие может выполнить только живой игрок.");
  if (state.actionsUsed.includes(actorId)) throw new Error("Игрок уже использовал публичное действие сегодня.");

  const next: DayState = {
    ...state,
    actionsUsed: [...state.actionsUsed, actorId],
    clueDeck: [...state.clueDeck],
    privateEvidence: Object.fromEntries(Object.entries(state.privateEvidence).map(([id, cards]) => [id, [...cards]])),
    publicEvidence: [...state.publicEvidence],
    interrogations: [...state.interrogations],
    nominations: [...state.nominations],
    publicLog: [...state.publicLog]
  };

  if (action.type === "search-room") {
    if (next.clueDeck.length === 0) throw new Error("Улики в этой партии закончились.");
    const index = next.clueDeck.findIndex((card) => card.room === action.room);
    const drawIndex = index >= 0 ? index : 0;
    const [card] = next.clueDeck.splice(drawIndex, 1);
    next.privateEvidence[actorId] = [...(next.privateEvidence[actorId] ?? []), card];
    next.publicLog.push(`${actor.name} обыскал(а) комнату: ${roomName(action.room)}.`);
    return { state: next, message: "Ты нашёл улику. Пока она известна только тебе.", foundEvidence: card };
  }

  if (action.type === "interrogate") {
    const target = players.find((player) => player.id === action.targetId && player.alive);
    if (!target || target.id === actorId) throw new Error("Можно допросить другого живого игрока.");
    const question = action.question.trim();
    if (!question || question.length > 180) throw new Error("Вопрос должен содержать от 1 до 180 символов.");
    next.interrogations.push({ askerId: actorId, targetId: target.id, question });
    next.publicLog.push(`${actor.name} допрашивает игрока ${target.name}.`);
    return { state: next, message: `${target.name} должен ответить вслух. Он может солгать.` };
  }

  if (action.type === "share-evidence") {
    const inventory = next.privateEvidence[actorId] ?? [];
    const index = inventory.findIndex((card) => card.id === action.evidenceId);
    if (index < 0) throw new Error("У тебя нет этой улики.");
    const [card] = inventory.splice(index, 1);
    next.privateEvidence[actorId] = inventory;
    next.publicEvidence.push(card);
    next.publicLog.push(`${actor.name} раскрыл(а) улику: ${card.title}.`);
    return { state: next, message: "Улика стала известна всем игрокам." };
  }

  if (action.type === "study-ritual") {
    const [firstId, secondId] = action.evidenceIds;
    if (firstId === secondId) throw new Error("Нужны две разные улики.");
    const first = next.publicEvidence.find((card) => card.id === firstId);
    const second = next.publicEvidence.find((card) => card.id === secondId);
    if (!first || !second || first.kind !== "ritual" || second.kind !== "ritual") {
      throw new Error("Для изучения ритуала нужны две публичные ритуальные улики.");
    }
    if (next.ritualProgress <= 0) throw new Error("Ритуал ещё не продвинулся.");
    next.publicEvidence = next.publicEvidence.filter((card) => card.id !== firstId && card.id !== secondId);
    next.ritualProgress -= 1;
    next.publicLog.push(`${actor.name} изучил(а) ритуальные улики. Прогресс ритуала уменьшился.`);
    return { state: next, message: "Вы потратили две улики и замедлили ритуал." };
  }

  const target = players.find((player) => player.id === action.targetId && player.alive);
  if (!target || target.id === actorId) throw new Error("Можно обвинить другого живого игрока.");
  if (next.nominations.includes(target.id)) throw new Error("Этот игрок уже выдвинут на суд сегодня.");
  next.nominations.push(target.id);
  next.publicLog.push(`${actor.name} выдвинул(а) ${target.name} на суд.`);
  return { state: next, message: `${target.name} выдвинут на публичный суд.` };
}

function roomName(room: MansionRoom): string {
  const names: Record<MansionRoom, string> = {
    library: "библиотека",
    chapel: "часовня",
    kitchen: "кухня",
    observatory: "обсерватория",
    basement: "подвал"
  };
  return names[room];
}
