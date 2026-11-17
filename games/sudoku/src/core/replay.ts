/**
 * Replay：{ kernelVersion, generatorVersion, seed, options, commands }，也是 Save 的 `current`。
 * 重演 = 用同版本生成器重新生成题目，再依次应用命令。
 */
import type { Command } from "./commands"
import { isUtcDate } from "./daily"
import { GENERATORS } from "./generators"
import { kernel, type State } from "./kernel"
import { isDifficulty, type Difficulty, type Puzzle } from "./puzzle"

export interface ReplayOptions {
  difficulty: Difficulty
  /** Daily Puzzle 的 UTC 日期；随机开局没有这个字段。 */
  daily?: string
}

export interface Replay {
  kernelVersion: number
  generatorVersion: number
  seed: string
  options: ReplayOptions
  commands: Command[]
}

/** 结构校验（命令本身的合法性由内核判断，非法命令会被忽略）。 */
export function isReplay(value: unknown): value is Replay {
  if (typeof value !== "object" || value === null) return false
  const r = value as Record<string, unknown>
  const options = r.options as Record<string, unknown> | null
  return (
    typeof r.kernelVersion === "number" &&
    typeof r.generatorVersion === "number" &&
    typeof r.seed === "string" &&
    typeof options === "object" &&
    options !== null &&
    isDifficulty(options.difficulty) &&
    (options.daily === undefined || (typeof options.daily === "string" && isUtcDate(options.daily))) &&
    Array.isArray(r.commands)
  )
}

/** 当前内核与生成器能否重演这份 Replay。 */
export function canReplay(replay: Replay): boolean {
  return replay.kernelVersion === kernel.version && replay.generatorVersion in GENERATORS
}

/** 生成这份 Replay 的题目（Worker 里调用）。 */
export function replayPuzzle(replay: Pick<Replay, "generatorVersion" | "seed" | "options">): Puzzle {
  return GENERATORS[replay.generatorVersion]!(replay.seed, replay.options.difficulty)
}

/** 重演。puzzle 可以由 Worker 预先生成传入，只是缓存。不能重演时返回 null。 */
export function replay(r: Replay, puzzle?: Puzzle): State | null {
  if (!canReplay(r)) return null
  let state = kernel.start(puzzle ?? replayPuzzle(r))
  for (const command of r.commands) state = kernel.apply(state, command)
  return state
}
