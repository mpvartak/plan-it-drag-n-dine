import { describe, expect, it } from "vitest";
import { computeExpirationOverrideFromUserText } from "../supabase/functions/meal-plan-chat/expirationDate";

describe("computeExpirationOverrideFromUserText", () => {
  it("uses TODAY + N days (no off-by-one) for 'in N days'", () => {
    const today = "2026-01-02";
    expect(computeExpirationOverrideFromUserText("chicken in 2 days", today)).toBe("2026-01-04");
  });

  it("uses TODAY + N days (no off-by-one) for 'expiring in N days'", () => {
    const today = "2026-01-02";
    expect(computeExpirationOverrideFromUserText("chicken expiring in 2 days", today)).toBe("2026-01-04");
  });

  it("handles tomorrow", () => {
    const today = "2026-01-02";
    expect(computeExpirationOverrideFromUserText("milk tomorrow", today)).toBe("2026-01-03");
  });

  it("handles next week", () => {
    const today = "2026-01-02";
    expect(computeExpirationOverrideFromUserText("eggs next week", today)).toBe("2026-01-09");
  });
});
