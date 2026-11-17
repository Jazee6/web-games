/**
 * 回放金标（docs/architecture/README.md 第 9 节）：重演每份 Replay、生成每个固定日期的 Daily Puzzle，
 * 返回 名称 → 哈希。golden.test.ts 与已提交的 fixtures/golden.json 比对；
 * scripts/check-engines.ts 在 Bun 与 Node 上分别运行并比对。纯函数，只依赖 core/。
 */
import { dailySetup } from "./daily"
import easyComplete from "./fixtures/replays/easy-complete.json"
import hardHintsDaily from "./fixtures/replays/hard-hints-daily.json"
import invalidCommands from "./fixtures/replays/invalid-commands.json"
import mediumUndoRedo from "./fixtures/replays/medium-undo-redo.json"
import { GENERATORS } from "./generators"
import { kernel } from "./kernel"
import { replay, type Replay } from "./replay"

const REPLAYS: Record<string, unknown> = {
  "easy-complete": easyComplete,
  "hard-hints-daily": hardHintsDaily,
  "invalid-commands": invalidCommands,
  "medium-undo-redo": mediumUndoRedo,
}

/** 固定的一批 Daily Puzzle 日期，覆盖一周七天与首发日期前后。 */
export const GOLDEN_DATES = [
  "2026-11-10",
  "2026-11-16",
  "2026-11-17",
  "2026-11-18",
  "2026-11-19",
  "2026-11-20",
  "2026-11-21",
  "2026-11-22",
  "2026-12-31",
  "2027-02-28",
  "2028-02-29",
]

export function goldenHashes(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, data] of Object.entries(REPLAYS)) {
    const state = replay(data as Replay)
    out[`replay:${name}`] = state ? kernel.hash(state) : "unreplayable"
  }
  for (const date of GOLDEN_DATES) {
    const { seed, difficulty, generatorVersion } = dailySetup(date)
    out[`daily:${date}`] = kernel.hash(kernel.start(GENERATORS[generatorVersion]!(seed, difficulty)))
  }
  return out
}
