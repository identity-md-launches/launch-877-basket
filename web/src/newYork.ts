// Port of web/pinned/src/libraries/NewYorkTime.sol. Integer arithmetic only;
// never the browser time zone. Hours are seconds since Sunday 00:00 New York.
import { InputError } from "./chain";
export const WEEK = 604800n;
const DAY = 86400n;
export const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
function leap(year: bigint) {
  return year % 4n === 0n && (year % 100n !== 0n || year % 400n === 0n);
}
function jan1(year: bigint) {
  const y = year - 1n;
  return 365n * (year - 1970n) + y / 4n - y / 100n + y / 400n - 477n;
}
export function daylight(t: bigint): boolean {
  const days = t / DAY;
  let year = 1970n + days / 365n;
  while (jan1(year) > days) --year;
  const start = jan1(year);
  const march = start + 59n + (leap(year) ? 1n : 0n);
  const november = start + 304n + (leap(year) ? 1n : 0n);
  const marchSunday = march + ((7n - ((march + 4n) % 7n)) % 7n) + 7n;
  const novemberSunday = november + (7n - ((november + 4n) % 7n)) % 7n;
  return (
    t >= marchSunday * DAY + 7n * 3600n && t < novemberSunday * DAY + 6n * 3600n
  );
}
export function offset(t: bigint, dst: bigint): bigint {
  return dst === 2n || (dst === 0n && daylight(t)) ? 4n * 3600n : 5n * 3600n;
}
export function weekSecond(t: bigint, dst: bigint): bigint {
  return (t + 4n * DAY + WEEK - offset(t, dst)) % WEEK;
}
export function inside(t: bigint, from: bigint, to: bigint, dst: bigint) {
  if (from === 0n && to === 0n) return true;
  const s = weekSecond(t, dst);
  return s >= from && s < to;
}
// The first opening after now, as the contract would observe it. A daylight
// change between now and the opening shifts weekSecond by an hour; the
// corrections converge within three rounds.
export function nextOpening(now: bigint, from: bigint, dst: bigint): bigint {
  const s = weekSecond(now, dst);
  let t = now + (s < from ? from - s : WEEK - s + from);
  for (let i = 0; i < 3; i++) {
    let d = (((from - weekSecond(t, dst)) % WEEK) + WEEK) % WEEK;
    if (d > WEEK / 2n) d -= WEEK;
    if (d === 0n) break;
    t += d;
  }
  return t;
}
export function clockWords(seconds: bigint): string {
  const h = Number(seconds / 3600n) % 24,
    m = Number((seconds % 3600n) / 60n);
  if (seconds === DAY) return "24:00";
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}
// Weekday and time of a week second, e.g. 72000 -> "Sunday 8:00 pm".
export function weekdayWords(s: bigint): string {
  if (s === WEEK) return "Saturday 24:00";
  return `${weekdays[Number(s / DAY)]} ${clockWords(s % DAY)}`;
}
// Under Dst 1 or 2 the vault clock is a fixed UTC-5 or UTC-4, not New York time.
export function hoursWordsOf(from: bigint, to: bigint, dst = 0n): string {
  return from === 0n && to === 0n
    ? "always open"
    : `${weekdayWords(from)} to ${weekdayWords(to)} ${zoneWords(dst)}`;
}
export const dstWords = [
  "US daylight saving rule",
  "never daylight saving (UTC-5)",
  "always daylight saving (UTC-4)",
];
export function zoneWords(dst: bigint) {
  return dst === 1n ? "UTC-5" : dst === 2n ? "UTC-4" : "New York time";
}
// Calendar date of a timestamp in New York, formatted from t - offset(t) in UTC.
export function nyDate(t: bigint, dst: bigint): string {
  const local = new Date(Number(t - offset(t, dst)) * 1000);
  return local.toLocaleDateString("en-GB", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const two = (n: number) => String(n).padStart(2, "0");
// A timestamp in words, never dd/mm: "Sun 11 Oct 2026, 04:40 UTC (00:40 New
// York)". New York follows the US rule; its weekday is added when it differs.
export function dateWords(t: bigint): string {
  const utc = new Date(Number(t) * 1000),
    ny = new Date(Number(t - offset(t, 0n)) * 1000);
  const day = (d: Date) => weekdays[d.getUTCDay()].slice(0, 3);
  const clock = (d: Date) =>
    `${two(d.getUTCHours())}:${two(d.getUTCMinutes())}`;
  const nyDay = ny.getUTCDay() === utc.getUTCDay() ? "" : `${day(ny)} `;
  return `${day(utc)} ${utc.getUTCDate()} ${months[utc.getUTCMonth()]} ${utc.getUTCFullYear()}, ${clock(utc)} UTC (${nyDay}${clock(ny)} New York)`;
}
export function countdown(seconds: bigint): string {
  const total = seconds < 0n ? 0n : seconds;
  return `${total / 3600n} h ${(total % 3600n) / 60n} min`;
}
// Parse "Monday 9:30 am", "Friday 16:00" or "Saturday 24:00" to week seconds.
export function parseWeekTime(text: string, isEnd = false): bigint {
  const m = text
    .trim()
    .match(/^([A-Za-z]+)\s+(\d{1,2}):(\d{2})(?:\s*([AaPp])\.?[Mm]\.?)?$/);
  if (!m)
    throw new InputError(
      "Use a weekday and New York time, e.g. Monday 9:30 am or Friday 16:00.",
    );
  const day = weekdays.findIndex((w) => w.toLowerCase() === m[1].toLowerCase());
  if (day < 0) throw new InputError(`Unknown weekday ${m[1]}.`);
  let h = Number(m[2]);
  const min = Number(m[3]);
  if (m[4]) {
    if (h < 1 || h > 12) throw new InputError("Use 1-12 with am or pm.");
    h = (h % 12) + (m[4].toLowerCase() === "p" ? 12 : 0);
  }
  if (min > 59) throw new InputError("Minutes must be 00-59.");
  if (h === 24 && min === 0 && day === 6 && isEnd) return WEEK;
  if (h > 23) throw new InputError("Hours must be 0-23 (Saturday 24:00 only as the end).");
  return BigInt(day) * DAY + BigInt(h) * 3600n + BigInt(min) * 60n;
}
export function parseHours(from: string, to: string): [bigint, bigint] {
  const always = (v: string) => /^always\s+open$/i.test(v.trim());
  if (always(from) || always(to)) {
    if (!(always(from) && always(to)))
      throw new InputError('Enter "Always open" in both fields, or two times.');
    return [0n, 0n];
  }
  const f = parseWeekTime(from),
    t = parseWeekTime(to, true);
  if (f >= t)
    throw new InputError("From must be earlier in the week than To.");
  return [f, t];
}
