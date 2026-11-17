/**
 * Daily Puzzle：同一 UTC 日期所有玩家同一题，只由 Game 与日期决定。
 * UTC 日期（YYYY-MM-DD）由外层传入，内核不读时钟。
 */
import type { Difficulty } from "./puzzle"
import { hashHex } from "./rng"

/** 生效日期 → 生成器版本。只能在末尾追加，历史日期的题目不变。早于首行的日期沿用首行版本。 */
export const DAILY_GENERATORS = [{ from: "2026-11-17", version: 1 }] as const

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

/** 按星期轮换难度，0 = 星期日。 */
const WEEKDAY_DIFFICULTY: readonly Difficulty[] = ["hard", "easy", "easy", "medium", "medium", "medium", "hard"]

export function isUtcDate(date: string): boolean {
  const m = DATE_RE.exec(date)
  if (!m) return false
  const month = Number(m[2])
  const day = Number(m[3])
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(Number(m[1]), month)
}

function daysInMonth(year: number, month: number) {
  if (month === 2) return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/** 自 1970-01-01 起的天数（Howard Hinnant 的 days_from_civil，只用整数运算）。 */
export function daysFromCivil(date: string): number {
  const m = DATE_RE.exec(date)!
  let y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (mo <= 2) y -= 1
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

/** 0 = 星期日 … 6 = 星期六。1970-01-01 是星期四。 */
export function weekday(date: string): number {
  return (((daysFromCivil(date) + 4) % 7) + 7) % 7
}

export function dailyGeneratorVersion(date: string): number {
  let version: number = DAILY_GENERATORS[0].version
  for (const entry of DAILY_GENERATORS) if (entry.from <= date) version = entry.version
  return version
}

export function dailyDifficulty(date: string): Difficulty {
  return WEEKDAY_DIFFICULTY[weekday(date)]!
}

/** 种子 = hash(slug, UTC 日期, 生成器版本)。 */
export function dailySeed(date: string, version = dailyGeneratorVersion(date)): string {
  return hashHex(`sudoku|${date}|v${version}`)
}

export function dailySetup(date: string) {
  const generatorVersion = dailyGeneratorVersion(date)
  return { seed: dailySeed(date, generatorVersion), difficulty: dailyDifficulty(date), generatorVersion }
}
