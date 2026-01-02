export const isYyyyMmDdDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/**
 * Adds days to a date-only YYYY-MM-DD string in a timezone-stable way.
 * Uses UTC internally so we don't drift across DST boundaries.
 */
export const addDaysDateOnly = (yyyyMmDd: string, days: number) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
  if (!m) return null;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
};

/**
 * Deterministically derives an expiration date from the user's text when they use relative phrases.
 *
 * Key contract (what we're testing):
 * - If today is 2026-01-02, then "in 2 days" => 2026-01-04 (TODAY + 2)
 */
export const computeExpirationOverrideFromUserText = (userText: string, today: string) => {
  if (!userText || !isYyyyMmDdDate(today)) return null;
  const lower = userText.toLowerCase();

  if (/\btomorrow\b/.test(lower)) return addDaysDateOnly(today, 1);
  if (/\b(next week|in a week)\b/.test(lower)) return addDaysDateOnly(today, 7);

  const m =
    /expir\w*[\s\S]*?(\d+)\s+day(s)?\b/i.exec(userText) ||
    /\bin\s+(\d+)\s+day(s)?\b/i.exec(userText);

  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n < 0) return null;

  // "in N days" means add N days to today (no inclusive/off-by-one adjustment).
  return addDaysDateOnly(today, n);
};

export const normalizeExpirationDateInput = (input: string) => {
  const trimmed = String(input).trim();
  if (!trimmed) return null;

  let year: number, month: number, day: number;
  const currentYear = new Date().getFullYear();
  const now = new Date();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    year = parseInt(isoMatch[1]);
    month = parseInt(isoMatch[2]);
    day = parseInt(isoMatch[3]);
  } else {
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    if (slashMatch) {
      month = parseInt(slashMatch[1]);
      day = parseInt(slashMatch[2]);
      year = slashMatch[3] ? parseInt(slashMatch[3]) : currentYear;
    } else {
      const parsed = new Date(trimmed + "T00:00:00Z");
      year = parsed.getUTCFullYear();
      month = parsed.getUTCMonth() + 1;
      day = parsed.getUTCDate();
    }
  }

  // If user gave a past year, assume current year (or next year if date already passed).
  if (year < currentYear) {
    year = currentYear;
    const testDate = new Date(year, month - 1, day);
    if (testDate < now) year = currentYear + 1;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};
