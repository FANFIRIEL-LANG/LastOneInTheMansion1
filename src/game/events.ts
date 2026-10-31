import type { MansionPlayer } from "./mafiaEngine";
import type { DayState, EvidenceCard } from "./dayActions";

export type MansionEventId = "blood-moon" | "locked-basement" | "whispering-portrait";
export type MansionEventChoiceId = "feed-ritual" | "resist-ritual" | "open-basement" | "seal-basement" | "listen-portrait" | "burn-portrait";
export type EventEffect = "ritual-up" | "ritual-down" | "reveal-clue" | "ritual-up-if-closed" | "medium-omen" | "burn-clue";

export interface MansionEventChoice {
  id: MansionEventChoiceId;
  label: string;
  effect: EventEffect;
}

export interface MansionEvent {
  id: MansionEventId;
  title: string;
  description: string;
  choices: [MansionEventChoice, MansionEventChoice];
  defaultChoiceId: MansionEventChoiceId;
}

export const MANSION_EVENT_DECK: MansionEvent[] = [
  {
    id: "blood-moon",
    title: "Кровавая луна",
    description: "Красный свет заполняет окна. Особняк требует продолжения ритуала.",
    choices: [
      { id: "feed-ritual", label: "Подчиниться и ускорить ритуал", effect: "ritual-up" },
      { id: "resist-ritual", label: "Сжечь ритуальную улику и сопротивляться", effect: "ritual-down" }
    ],
    defaultChoiceId: "feed-ritual"
  },
  {
    id: "locked-basement",
    title: "Запертый подвал",
    description: "Из-за двери доносится стук. Кто-то или что-то просит выпустить его.",
    choices: [
      { id: "open-basement", label: "Вскрыть дверь и раскрыть находку", effect: "reveal-clue" },
      { id: "seal-basement", label: "Оставить дверь запечатанной", effect: "ritual-up-if-closed" }
    ],
    defaultChoiceId: "seal-basement"
  },
  {
    id: "whispering-portrait",
    title: "Шепчущий портрет",
    description: "С портрета осыпается краска. Из-под неё проступает чужое лицо.",
    choices: [
      { id: "listen-portrait", label: "Прислушаться к голосу портрета", effect: "medium-omen" },
      { id: "burn-portrait", label: "Сжечь портрет вместе с уликой", effect: "burn-clue" }
    ],
    defaultChoiceId: "burn-portrait"
  }
];

export interface EventResolution {
  state: DayState;
  chosenChoiceId: MansionEventChoiceId;
  privateResults: Record<string, string>;
  publicMessage: string;
}

export function shuffleEvents(events: MansionEvent[] = MANSION_EVENT_DECK): MansionEvent[] {
  const result = [...events];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function resolveMansionEvent(
  players: MansionPlayer[],
  state: DayState,
  event: MansionEvent,
  votes: Record<string, MansionEventChoiceId>
): EventResolution {
  const eligible = players.filter((player) => player.alive);
  if (Object.keys(votes).length !== eligible.length || eligible.some((player) => !votes[player.id])) {
    throw new Error("Каждый живой игрок должен проголосовать за решение события.");
  }
  const validChoices = new Set(event.choices.map((choice) => choice.id));
  if (Object.values(votes).some((choice) => !validChoices.has(choice))) {
    throw new Error("Выбрано неизвестное решение события.");
  }

  const counts = new Map<MansionEventChoiceId, number>();
  for (const choice of Object.values(votes)) counts.set(choice, (counts.get(choice) ?? 0) + 1);
  const highest = Math.max(...counts.values());
  const leaders = [...counts.entries()].filter(([, count]) => count === highest);
  const chosenChoiceId = leaders.length === 1 && highest > eligible.length / 2 ? leaders[0][0] : event.defaultChoiceId;
  const choice = event.choices.find((item) => item.id === chosenChoiceId)!;
  const next: DayState = {
    ...state,
    clueDeck: [...state.clueDeck],
    privateEvidence: Object.fromEntries(Object.entries(state.privateEvidence).map(([id, cards]) => [id, [...cards]])),
    publicEvidence: [...state.publicEvidence],
    publicLog: [...state.publicLog]
  };
  const privateResults: Record<string, string> = {};
  let publicMessage = "";

  switch (choice.effect) {
    case "ritual-up":
    case "ritual-up-if-closed":
      next.ritualProgress = Math.min(5, next.ritualProgress + 1);
      publicMessage = "Ритуал усилился.";
      break;
    case "ritual-down": {
      const clueIndex = next.publicEvidence.findIndex((card) => card.kind === "ritual");
      if (clueIndex >= 0) {
        next.publicEvidence.splice(clueIndex, 1);
        next.ritualProgress = Math.max(0, next.ritualProgress - 1);
        publicMessage = "Группа пожертвовала ритуальной уликой и замедлила ритуал.";
      } else {
        publicMessage = "Не удалось найти ритуальную улику. Ритуал не замедлен.";
      }
      break;
    }
    case "reveal-clue": {
      const clue = next.clueDeck.shift();
      if (clue) {
        next.publicEvidence.push(clue);
        publicMessage = `Из подвала извлечена улика: ${clue.title}.`;
      } else {
        publicMessage = "За дверью ничего не осталось.";
      }
      break;
    }
    case "medium-omen": {
      const medium = eligible.find((player) => player.roleId === "medium");
      if (medium) privateResults[medium.id] = next.ritualProgress >= 3
        ? "Портрет шепчет: ритуал почти завершён."
        : "Портрет шепчет о движении под фундаментом.";
      publicMessage = "Портрет замолкает. Только медиум смог разобрать его шёпот.";
      break;
    }
    case "burn-clue":
      if (next.publicEvidence.length > 0) {
        const [burned] = next.publicEvidence.splice(0, 1);
        publicMessage = `Портрет сгорел вместе с уликой «${burned.title}».`;
      } else {
        publicMessage = "Портрет сгорел, но улик для уничтожения не было.";
      }
      break;
  }

  next.publicLog.push(`${event.title}: ${choice.label}. ${publicMessage}`);
  return { state: next, chosenChoiceId, privateResults, publicMessage };
}

function randomInt(max: number): number {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    const limit = Math.floor(0x1_0000_0000 / max) * max;
    do { globalThis.crypto.getRandomValues(value); } while (value[0] >= limit);
    return value[0] % max;
  }
  return Math.floor(Math.random() * max);
}
