export type MansionFaction = "guests" | "cult";
export type MansionRoleId = "cultist" | "acolyte" | "detective" | "doctor" | "medium" | "guardian" | "resident";
export type NightActionKind = "cult-select" | "investigate" | "protect" | "ward" | "commune" | "pass";

export interface MansionRole {
  id: MansionRoleId;
  name: string;
  faction: MansionFaction;
  nightAction: NightActionKind;
  description: string;
  objective: string;
}

export const MANSION_ROLES: Record<MansionRoleId, MansionRole> = {
  cultist: { id: "cultist", name: "Культист", faction: "cult", nightAction: "cult-select", description: "Ты служишь существу под особняком. Другие культисты знают тебя.", objective: "Доведи ритуал до завершения или добейся численного перевеса культа." },
  acolyte: { id: "acolyte", name: "Послушник", faction: "cult", nightAction: "cult-select", description: "Ты тайно помогаешь культу и знаешь его участников.", objective: "Помогай культу, сбивай расследование с пути и не выдавай союзников." },
  detective: { id: "detective", name: "Детектив", faction: "guests", nightAction: "investigate", description: "Ты расследуешь исчезновения в особняке.", objective: "Собирай правдивые сведения и помоги гостям вычислить культ." },
  doctor: { id: "doctor", name: "Доктор", faction: "guests", nightAction: "protect", description: "Ты можешь защитить одного гостя от ночного нападения.", objective: "Сохрани жизни и не дай культу ослабить группу." },
  medium: { id: "medium", name: "Медиум", faction: "guests", nightAction: "commune", description: "Ты получаешь неполные послания от духов особняка.", objective: "Соедини обрывки посланий и помоги раскрыть правду." },
  guardian: { id: "guardian", name: "Хранитель", faction: "guests", nightAction: "ward", description: "Ты можешь поставить защиту на одного игрока.", objective: "Предугадывай опасность и защищай тех, кто важен для расследования." },
  resident: { id: "resident", name: "Житель", faction: "guests", nightAction: "pass", description: "У тебя нет ночной способности, но ты участвуешь во всех общих действиях.", objective: "Используй публичные действия, личное задание и обсуждение, чтобы найти культ." }
};

export interface MansionPlayer {
  id: string;
  name: string;
  roleId: MansionRoleId;
  alive: boolean;
  wounds: number;
  ghostVoteAvailable: boolean;
}

export interface NightAction {
  actorId: string;
  kind: NightActionKind;
  targetId?: string;
}

export interface NightResolution {
  players: MansionPlayer[];
  ritualProgress: number;
  attackedPlayerId: string | null;
  attackBlocked: boolean;
  privateResults: Record<string, string>;
}

export interface VoteResolution {
  players: MansionPlayer[];
  banishedPlayerId: string | null;
  voteCounts: Record<string, number>;
}

export type Victory = "guests" | "cult" | null;
export const RITUAL_LIMIT = 5;
const WOUNDS_TO_GHOST = 2;

export function roleSetForPlayerCount(count: number): MansionRoleId[] {
  const sets: Record<number, MansionRoleId[]> = {
    4: ["cultist", "detective", "doctor", "resident"],
    5: ["cultist", "detective", "doctor", "medium", "resident"],
    6: ["cultist", "acolyte", "detective", "doctor", "medium", "guardian"],
    7: ["cultist", "acolyte", "detective", "doctor", "medium", "guardian", "resident"]
  };
  const roles = sets[count];
  if (!roles) throw new Error("В игре должно быть от 4 до 7 игроков.");
  return [...roles];
}

export function createMansionPlayers(names: string[]): MansionPlayer[] {
  if (names.length < 4 || names.length > 7) throw new Error("В игре должно быть от 4 до 7 игроков.");
  const roles = secureShuffle(roleSetForPlayerCount(names.length));
  return names.map((name, index) => ({
    id: `p${index + 1}`,
    name: name.trim() || `Игрок ${index + 1}`,
    roleId: roles[index],
    alive: true,
    wounds: 0,
    ghostVoteAvailable: false
  }));
}

export function resolveNight(players: MansionPlayer[], actions: NightAction[], ritualProgress: number, publicProtectionTargetId: string | null = null): NightResolution {
  const living = players.filter((player) => player.alive);
  if (actions.length !== living.length) throw new Error("Каждый живой игрок должен получить приватный ночной ход.");
  const byActor = new Map(actions.map((action) => [action.actorId, action]));
  if (byActor.size !== actions.length || living.some((player) => !byActor.has(player.id))) {
    throw new Error("Ночной ход должен быть ровно один для каждого живого игрока.");
  }

  for (const action of actions) {
    const actor = living.find((player) => player.id === action.actorId);
    if (!actor) throw new Error("Нельзя выполнить действие от имени выбывшего игрока.");
    if (MANSION_ROLES[actor.roleId].nightAction !== action.kind) {
      throw new Error(`Роль игрока ${actor.name} не может выполнить это ночное действие.`);
    }
    if (action.kind !== "pass" && action.kind !== "commune") {
      const target = living.find((player) => player.id === action.targetId);
      const mayTargetSelf = action.kind === "protect" || action.kind === "ward";
      if (!target || (target.id === actor.id && !mayTargetSelf)) throw new Error("Нужно выбрать другого живого игрока.");
      if (action.kind === "cult-select" && MANSION_ROLES[target.roleId].faction === "cult") {
        throw new Error("Культ не может выбрать своей целью участника культа.");
      }
    }
  }

  const cultChoices = actions.filter((action) => action.kind === "cult-select").map((action) => action.targetId!);
  const protections = new Set(actions.filter((action) => action.kind === "protect" || action.kind === "ward").map((action) => action.targetId!));
  if (publicProtectionTargetId) protections.add(publicProtectionTargetId);
  const privateResults: Record<string, string> = {};

  for (const action of actions.filter((item) => item.kind === "investigate")) {
    const target = living.find((player) => player.id === action.targetId)!;
    privateResults[action.actorId] = MANSION_ROLES[target.roleId].faction === "cult"
      ? "Следы указывают на связь с культом."
      : "Ты не находишь признаков принадлежности к культу.";
  }

  for (const action of actions.filter((item) => item.kind === "commune")) {
    const ghosts = players.filter((player) => !player.alive).length;
    privateResults[action.actorId] = ghosts > 0
      ? `Духи шепчут: в особняке уже ${ghosts} призрачных присутствия.`
      : "Духи молчат. Но под фундаментом что-то шевелится.";
  }

  const choiceCounts = new Map<string, number>();
  for (const choice of cultChoices) choiceCounts.set(choice, (choiceCounts.get(choice) ?? 0) + 1);
  const maxVotes = Math.max(0, ...choiceCounts.values());
  const leaders = [...choiceCounts.entries()].filter(([, count]) => count === maxVotes);
  const attackedPlayerId = leaders.length === 1 ? leaders[0][0] : null;
  const attackBlocked = attackedPlayerId !== null && protections.has(attackedPlayerId);
  let nextRitualProgress = ritualProgress;
  let nextPlayers = players.map((player) => ({ ...player }));

  if (attackedPlayerId && !attackBlocked) {
    nextPlayers = nextPlayers.map((player) => {
      if (player.id !== attackedPlayerId) return player;
      const wounds = player.wounds + 1;
      return { ...player, wounds, alive: wounds < WOUNDS_TO_GHOST, ghostVoteAvailable: wounds >= WOUNDS_TO_GHOST };
    });
    nextRitualProgress = Math.min(RITUAL_LIMIT, ritualProgress + 1);
  }

  for (const action of actions.filter((item) => item.kind === "protect" || item.kind === "ward")) {
    privateResults[action.actorId] = protections.has(action.targetId!)
      ? "Твоя защита установлена."
      : "Защита не сработала.";
  }

  return { players: nextPlayers, ritualProgress: nextRitualProgress, attackedPlayerId, attackBlocked, privateResults };
}

export function resolveVote(players: MansionPlayer[], votes: Record<string, string>): VoteResolution {
  const eligible = players.filter((player) => player.alive || player.ghostVoteAvailable);
  const eligibleIds = new Set(eligible.map((player) => player.id));
  const voters = Object.keys(votes);
  if (voters.length !== eligible.length || voters.some((id) => !eligibleIds.has(id))) {
    throw new Error("Каждый живой игрок и каждый призрак с неиспользованным голосом должны проголосовать ровно один раз.");
  }
  for (const voter of eligible) {
    const targetId = votes[voter.id];
    const target = players.find((player) => player.id === targetId);
    if (!target?.alive || target.id === voter.id) throw new Error("Голосовать можно только против другого живого игрока.");
  }

  const voteCounts = Object.values(votes).reduce<Record<string, number>>((counts, targetId) => {
    counts[targetId] = (counts[targetId] ?? 0) + 1;
    return counts;
  }, {});
  const highest = Math.max(0, ...Object.values(voteCounts));
  const leaders = Object.entries(voteCounts).filter(([, count]) => count === highest);
  const banishedPlayerId = leaders.length === 1 && highest > eligible.length / 2 ? leaders[0][0] : null;
  const nextPlayers = players.map((player) => {
    if (player.id === banishedPlayerId) return { ...player, alive: false, ghostVoteAvailable: true };
    if (!player.alive && player.ghostVoteAvailable) return { ...player, ghostVoteAvailable: false };
    return player;
  });
  return { players: nextPlayers, banishedPlayerId, voteCounts };
}

export function getMansionVictory(players: MansionPlayer[], ritualProgress: number): Victory {
  const livingCult = players.filter((player) => player.alive && MANSION_ROLES[player.roleId].faction === "cult").length;
  const livingGuests = players.filter((player) => player.alive && MANSION_ROLES[player.roleId].faction === "guests").length;
  if (livingCult === 0) return "guests";
  if (ritualProgress >= RITUAL_LIMIT || livingCult >= livingGuests) return "cult";
  return null;
}

function secureShuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const value = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) {
      const limit = Math.floor(0x1_0000_0000 / (index + 1)) * (index + 1);
      do { globalThis.crypto.getRandomValues(value); } while (value[0] >= limit);
      const target = value[0] % (index + 1);
      [result[index], result[target]] = [result[target], result[index]];
    } else {
      const target = Math.floor(Math.random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
  }
  return result;
}
