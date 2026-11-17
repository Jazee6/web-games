/**
 * Save（ADR-0002，docs/architecture/README.md 第 8 节）：一律经 Game Contract，值为 JsonValue。
 * 每个 key 的值包成 { v, data }，读取时按迁移表逐级升级到当前版本。迁移函数只增不改。
 */
import type { GameSession } from "@web-games/game-contract/game"
import type { JsonValue } from "@web-games/game-contract"
import { isReplay, type Replay } from "../core/replay"
import { DIFFICULTIES, isDifficulty, type Difficulty } from "../core/puzzle"
import { isUtcDate } from "../core/daily"

export interface Saved<T> {
  v: number
  data: T
}

export interface Schema<T> {
  version: number
  /** migrations[n] 把 vn 的数据升级为 v(n+1)。 */
  migrations: Readonly<Record<number, (old: unknown) => unknown>>
  validate(data: unknown): data is T
  fallback(): T
}

/**
 * 把任意已存数据升级到当前版本。缺失、来自更新的版本、迁移失败或校验不过时返回 fallback()。
 * 永不抛异常。
 */
export function upgrade<T>(raw: unknown, schema: Schema<T>): T {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return schema.fallback()
  const saved = raw as Partial<Saved<unknown>>
  if (typeof saved.v !== "number" || !Number.isInteger(saved.v) || saved.v < 1 || saved.v > schema.version)
    return schema.fallback()
  let data = saved.data
  try {
    for (let v = saved.v; v < schema.version; v++) {
      const migrate = schema.migrations[v]
      if (!migrate) return schema.fallback()
      data = migrate(data)
    }
  } catch {
    return schema.fallback()
  }
  return schema.validate(data) ? data : schema.fallback()
}

// ---- settings ----

export interface Settings {
  difficulty: Difficulty
}

export const settingsSchema: Schema<Settings> = {
  version: 1,
  migrations: {},
  validate: (d): d is Settings => isRecord(d) && isDifficulty(d.difficulty),
  fallback: () => ({ difficulty: "easy" }),
}

// ---- current：进行中的一局 = 一份 Replay，加上存档时的有效用时 ----

export interface CurrentGame {
  replay: Replay
  /**
   * 存档时的有效用时（扣除暂停）。命令只记录到最后一步的 ms，
   * 没有它的话，刷新会丢掉最后一步之后的思考时间。恢复时取它与最后一步 ms 的较大值。
   */
  elapsedMs: number
}

export const currentSchema: Schema<CurrentGame | null> = {
  version: 1,
  migrations: {},
  validate: (d): d is CurrentGame | null => d === null || (isRecord(d) && isReplay(d.replay) && isCount(d.elapsedMs)),
  fallback: () => null,
}

// ---- daily：每个 UTC 日期的完成状态与用时 ----

export interface DailyRecord {
  ms: number
  hints: number
}
export type DailyLog = Record<string, DailyRecord>

export const dailySchema: Schema<DailyLog> = {
  version: 1,
  migrations: {},
  validate: (d): d is DailyLog =>
    isRecord(d) &&
    Object.entries(d).every(([date, r]) => isUtcDate(date) && isRecord(r) && isCount(r.ms) && isCount(r.hints)),
  fallback: () => ({}),
}

// ---- stats ----

export interface DifficultyStats {
  started: number
  solved: number
  /** 不用提示完成的最短用时。 */
  bestMs: number | null
}
export type Stats = Record<Difficulty, DifficultyStats>

export const statsSchema: Schema<Stats> = {
  version: 1,
  migrations: {},
  validate: (d): d is Stats =>
    isRecord(d) &&
    DIFFICULTIES.every((k) => {
      const s = d[k]
      return isRecord(s) && isCount(s.started) && isCount(s.solved) && (s.bestMs === null || isCount(s.bestMs))
    }),
  fallback: () => ({
    easy: { started: 0, solved: 0, bestMs: null },
    medium: { started: 0, solved: 0, bestMs: null },
    hard: { started: 0, solved: 0, bestMs: null },
  }),
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function isCount(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0
}

// ---- 读写 ----

export const SCHEMAS = {
  settings: settingsSchema,
  current: currentSchema,
  daily: dailySchema,
  stats: statsSchema,
} as const
export type SaveKey = keyof typeof SCHEMAS
type SaveData = { [K in SaveKey]: (typeof SCHEMAS)[K] extends Schema<infer T> ? T : never }

export async function readSave<K extends SaveKey>(session: GameSession, key: K): Promise<SaveData[K]> {
  const schema = SCHEMAS[key] as unknown as Schema<SaveData[K]>
  try {
    return upgrade(await session.save.get(key), schema)
  } catch {
    return schema.fallback()
  }
}

/** 节流写入：每次 schedule 后约 500 ms 合并写一次；flush 立即写出（pause 时调用）。 */
export function createSaveWriter(session: GameSession, delayMs = 500) {
  const pending = new Map<SaveKey, JsonValue>()
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    clearTimeout(timer)
    timer = undefined
    for (const [key, data] of pending) {
      const value: JsonValue = { v: SCHEMAS[key].version, data }
      session.save.set(key, value).catch(() => {})
    }
    pending.clear()
  }

  return {
    schedule<K extends SaveKey>(key: K, data: SaveData[K]) {
      pending.set(key, data as unknown as JsonValue)
      if (timer === undefined) timer = setTimeout(flush, delayMs)
    },
    flush,
  }
}
