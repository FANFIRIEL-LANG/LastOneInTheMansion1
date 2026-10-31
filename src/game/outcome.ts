export type WinningTeam = "guests" | "entity";

/** Guests win only when a strict majority votes for the possessed player. */
export function getWinningTeam(possessedPlayerId: string, votes: Record<string, string>, totalPlayers: number): WinningTeam {
  if (totalPlayers < 4) throw new Error("A game requires at least four players.");
  const possessedVotes = Object.values(votes).filter((suspectId) => suspectId === possessedPlayerId).length;
  const majority = Math.floor(totalPlayers / 2) + 1;
  return possessedVotes >= majority ? "guests" : "entity";
}
