import type { Role, RoleId } from "./types";

export const ROLE_CATALOG: Record<RoleId, Role> = {
  survivor: { id: "survivor", name: "Гость", team: "guests", description: "Ты приехал на вечеринку и хочешь выбраться из особняка.", objective: "Помоги гостям пережить ночь и вычислить одержимого." },
  possessed: { id: "possessed", name: "Одержимый", team: "entity", description: "Внутри тебя поселилось нечто. Ты выглядишь обычным гостем.", objective: "Сбивай остальных с толку и не дай им раскрыть тебя." },
  medium: { id: "medium", name: "Медиум", team: "guests", description: "Ты слышишь шёпот мёртвых и замечаешь странности.", objective: "Помоги группе найти правду, не раскрывая свои способности слишком рано." },
  skeptic: { id: "skeptic", name: "Скептик", team: "guests", description: "Ты не веришь в призраков. Но особняк явно что-то скрывает.", objective: "Проверяй версии и не позволяй страху управлять голосованием." },
  trickster: { id: "trickster", name: "Плут", team: "guests", description: "Ты любишь хаос и умеешь превращать любой спор в спектакль.", objective: "Добейся, чтобы тебя запомнили, но не помогай одержимому победить." },
  guardian: { id: "guardian", name: "Хранитель", team: "guests", description: "Старая клятва защищает тебя и одного из гостей.", objective: "Сохрани группу и поддержи того, кому доверяешь." },
  detective: { id: "detective", name: "Сыщик", team: "guests", description: "Ты приехал расследовать исчезновение прежних гостей.", objective: "Собирай противоречия и веди группу к обоснованному решению." }
};

export function assignRoles(names: string[], includeTrickster = true): Role[] {
  if (names.length < 4 || names.length > 7) throw new Error("В игре должно быть от 4 до 7 игроков.");
  const roles: Role[] = [ROLE_CATALOG.possessed, ROLE_CATALOG.medium, ROLE_CATALOG.skeptic, ROLE_CATALOG.guardian];
  const optional: RoleId[] = ["detective", "survivor", "trickster"];
  while (roles.length < names.length) {
    const next = optional.shift()!;
    if (next === "trickster" && !includeTrickster) continue;
    roles.push(ROLE_CATALOG[next]);
  }
  return secureShuffle(roles);
}

function secureShuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function randomInt(max: number): number {
  if (typeof globalThis.crypto !== "undefined") {
    const value = new Uint32Array(1);
    const limit = Math.floor(0x1_0000_0000 / max) * max;
    do { crypto.getRandomValues(value); } while (value[0] >= limit);
    return value[0] % max;
  }
  return Math.floor(Math.random() * max);
}
