export type AppLifecycleEvent = "visibilitychange" | "blur" | "pagehide";
export type SecretScreen = "secret" | "ready" | "handoff" | "intro" | "round" | "vote" | "ending" | "home" | "setup";

/** Decide whether an app lifecycle event must immediately conceal a private role. */
export function shouldConcealSecretRole(
  screen: SecretScreen,
  event: AppLifecycleEvent,
  visibilityState?: DocumentVisibilityState
): boolean {
  if (screen !== "secret") return false;
  if (event === "visibilitychange") return visibilityState === "hidden";
  return true;
}
