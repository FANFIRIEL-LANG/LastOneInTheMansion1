import { describe, expect, it } from "vitest";
import { confirmPhoneReceived, hideAndPass, revealRole, startRoleFlow } from "./transfer";

describe("secret role handoff", () => {
  it("does not reveal a role before the recipient confirms they have the phone", () => {
    const state = startRoleFlow();
    expect(state.stage).toBe("handoff");
    expect(revealRole(state).stage).toBe("handoff");
  });
  it("requires an explicit receive-phone action before reveal", () => {
    const ready = confirmPhoneReceived(startRoleFlow());
    expect(ready.stage).toBe("ready");
    expect(revealRole(ready).stage).toBe("secret");
  });
  it("hides the role and moves to next player after acknowledgement", () => {
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
