import { describe, expect, it } from "vitest";
import { confirmPhoneReceived, concealRole, hideAndPass, revealRole, startRoleFlow } from "./transfer";

describe("secret role handoff", () => {
  it("does not reveal a role before the recipient confirms they have the phone", () => {
    const state = startRoleFlow();
    expect(state.stage).toBe("handoff");
    expect(revealRole(state).stage).toBe("handoff");
  });
  it("requires explicit receive-phone and reveal actions", () => {
    const ready = confirmPhoneReceived(startRoleFlow());
    expect(ready.stage).toBe("ready");
    expect(revealRole(ready).stage).toBe("secret");
  });
  it("hides a secret on app background without skipping the current player", () => {
    const secret = revealRole(confirmPhoneReceived(startRoleFlow()));
    expect(concealRole(secret)).toEqual({ stage: "ready", playerIndex: 0 });
  });
  it("moves to the next player only after acknowledgement", () => {
    const secret = revealRole(confirmPhoneReceived(startRoleFlow()));
    const next = hideAndPass(secret, 5);
    expect(next.stage).toBe("handoff");
    expect(next.playerIndex).toBe(1);
  });
  it("does not allow a second reveal while already on secret screen", () => {
    const secret = revealRole(confirmPhoneReceived(startRoleFlow()));
    expect(revealRole(secret)).toEqual(secret);
  });
  it("ends role distribution after the final player", () => {
    const final = { stage: "secret" as const, playerIndex: 4 };
    expect(hideAndPass(final, 5)).toEqual({ stage: "next", playerIndex: 4 });
  });
});
