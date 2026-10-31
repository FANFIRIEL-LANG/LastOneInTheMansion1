import { describe, expect, it } from "vitest";
import { shouldConcealSecretRole } from "./privacyLifecycle";

describe("secret role privacy lifecycle", () => {
  it("conceals a secret when the page becomes hidden", () => {
    expect(shouldConcealSecretRole("secret", "visibilitychange", "hidden")).toBe(true);
  });

  it("conceals a secret when the web view loses focus", () => {
    expect(shouldConcealSecretRole("secret", "blur")).toBe(true);
  });

  it("conceals a secret before the page is suspended or navigated away", () => {
    expect(shouldConcealSecretRole("secret", "pagehide")).toBe(true);
  });

  it("does not conceal a secret on a visible visibility change", () => {
    expect(shouldConcealSecretRole("secret", "visibilitychange", "visible")).toBe(false);
  });

  it("does not alter other screens when the app backgrounds", () => {
    expect(shouldConcealSecretRole("ready", "visibilitychange", "hidden")).toBe(false);
    expect(shouldConcealSecretRole("round", "pagehide")).toBe(false);
  });
});
