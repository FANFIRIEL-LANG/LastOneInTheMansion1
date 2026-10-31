export type TransferStage = "handoff" | "ready" | "secret" | "next";

export interface TransferState { stage: TransferStage; playerIndex: number; }

/** Pure state transitions for pass-the-phone secret role delivery. */
export function startRoleFlow(): TransferState { return { stage: "handoff", playerIndex: 0 }; }
export function confirmPhoneReceived(state: TransferState): TransferState {
  if (state.stage !== "handoff") return state;
  return { ...state, stage: "ready" };
}
export function revealRole(state: TransferState): TransferState {
  return state.stage === "ready" ? { ...state, stage: "secret" } : state;
}
/** Hide a role when the app is backgrounded, but keep the same player and require another explicit reveal. */
export function concealRole(state: TransferState): TransferState {
  return state.stage === "secret" ? { ...state, stage: "ready" } : state;
}
export function hideAndPass(state: TransferState, totalPlayers: number): TransferState {
  if (state.stage !== "secret") return state;
  if (state.playerIndex + 1 >= totalPlayers) return { stage: "next", playerIndex: state.playerIndex };
  return { stage: "handoff", playerIndex: state.playerIndex + 1 };
}
