// Activity board read (WP-417 Ф7): days x channels for the calling account, straight
// from public.activity_days in the learning database (DRR-f75 v2). The account is
// always the authenticated caller; the tool has no account argument. Nothing read
// here is cached or written into the twin — all-time totals, streak and record are
// the Profiler's job in 3_derived.
import { TwinStoreError } from "./twin-store.js";

export const DEFAULT_PERIOD_DAYS = 28;
export const MAX_PERIOD_DAYS = 400;
// One row per day and channel: 400 days x 4 channels plus "other", with headroom.
export const MAX_ROWS = 2000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

export function moscowToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

function parseDate(value, field) {
  if (typeof value !== "string" || !ISO_DATE.test(value)) {
    throw new TwinStoreError("invalid_period", `${field} must be a date YYYY-MM-DD`);
  }
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time) || new Date(time).toISOString().slice(0, 10) !== value) {
    throw new TwinStoreError("invalid_period", `${field} is not a real calendar date`);
  }
  return time;
}

function isoDate(time) {
  return new Date(time).toISOString().slice(0, 10);
}

// Inclusive Moscow-date period; defaults to the last DEFAULT_PERIOD_DAYS ending today.
export function activityPeriod({ from, to } = {}, today = moscowToday()) {
  const todayTime = parseDate(today, "today");
  const toTime = to === undefined ? todayTime : parseDate(to, "to");
  const fromTime = from === undefined ? toTime - (DEFAULT_PERIOD_DAYS - 1) * DAY_MS : parseDate(from, "from");
  if (toTime > todayTime) throw new TwinStoreError("invalid_period", "to cannot be later than today (Moscow)");
  if (fromTime > toTime) throw new TwinStoreError("invalid_period", "from cannot be later than to");
  const days = (toTime - fromTime) / DAY_MS + 1;
  if (days > MAX_PERIOD_DAYS) {
    throw new TwinStoreError("invalid_period", `period is ${days} days; at most ${MAX_PERIOD_DAYS}`);
  }
  return { from: isoDate(fromTime), to: isoDate(toTime) };
}

export function createActivityReader(sql, userId, { now = () => new Date() } = {}) {
  async function readActivity(args = {}) {
    if (typeof userId !== "string" || !UUID.test(userId)) {
      throw new TwinStoreError("invalid_account", "Activity is available only for a platform account");
    }
    const asOf = now();
    const period = activityPeriod(args, moscowToday(asOf));
    let rows;
    try {
      rows = await sql.query(
        "SELECT day::text AS day, channel, events FROM public.activity_days($1::uuid, $2::date, $3::date) LIMIT $4",
        [userId, period.from, period.to, MAX_ROWS + 1],
      );
    } catch (error) {
      console.error("[activity-reader] database request failed", { type: error.name });
      throw new TwinStoreError("storage_error", "Activity storage request failed");
    }
    if (rows.length > MAX_ROWS) {
      console.error("[activity-reader] row cap exceeded", { cap: MAX_ROWS });
      throw new TwinStoreError("too_many_rows", `Activity answer exceeds ${MAX_ROWS} rows; ask for a shorter period`);
    }
    return {
      source: "learning.domain_event",
      as_of: asOf.toISOString(),
      period,
      days: rows.map(({ day, channel, events }) => ({ day, channel, events: Number(events) })),
    };
  }
  return { readActivity };
}
