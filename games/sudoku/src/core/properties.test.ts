/**
 * 属性测试（fast-check）：对任意种子与命令序列断言不变式。
 */
import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import type { Command } from "./commands"
import { countSolutions } from "./dlx"
import { generate } from "./generators/v1"
import { UNITS, parseGrid } from "./grid"
import { kernel, type State } from "./kernel"
import { rate } from "./logic"
import { DIFFICULTIES, inBand, type Puzzle } from "./puzzle"
import { replay, type Replay } from "./replay"

const seed = fc.string({ minLength: 1, maxLength: 16 })
const difficulty = fc.constantFrom(...DIFFICULTIES)
const TIMEOUT = 60_000

/** 合法与非法混合的命令，ms 由序号决定。 */
const rawCommand = fc.oneof(
  fc.record({
    t: fc.constant("place"),
    cell: fc.integer({ min: -2, max: 82 }),
    digit: fc.integer({ min: -1, max: 10 }),
  }),
  fc.record({ t: fc.constant("note"), cell: fc.integer({ min: 0, max: 80 }), digit: fc.integer({ min: 1, max: 9 }) }),
  fc.record({ t: fc.constant("clear"), cell: fc.integer({ min: 0, max: 80 }) }),
  fc.record({ t: fc.constantFrom("hint", "undo", "redo") }),
  fc.record({ t: fc.constantFrom("undo", "redo") }),
  fc.anything(),
)
const commands = fc
  .array(rawCommand, { maxLength: 80 })
  .map(
    (list) =>
      list.map((c, i) =>
        typeof c === "object" && c !== null && !Array.isArray(c) ? { ...c, ms: i * 1000 } : c,
      ) as Command[],
  )

// 生成器较慢，按种子缓存。
const cache = new Map<string, Puzzle>()
function puzzleFor(s: string, d: (typeof DIFFICULTIES)[number]) {
  const key = `${d}/${s}`
  if (!cache.has(key)) cache.set(key, generate(s, d))
  return cache.get(key)!
}

function isValidSolution(grid: number[]) {
  return UNITS.every(
    (unit) => new Set(unit.map((cell) => grid[cell])).size === 9 && unit.every((cell) => grid[cell]! >= 1),
  )
}

describe("生成器", () => {
  test(
    "任意种子、任意难度：有且只有一个解，且解与给定数一致",
    () => {
      fc.assert(
        fc.property(seed, difficulty, (s, d) => {
          const p = puzzleFor(s, d)
          const givens = parseGrid(p.givens)
          const solution = parseGrid(p.solution)
          expect(countSolutions(givens, 2)).toBe(1)
          expect(isValidSolution(solution)).toBe(true)
          givens.forEach((v, i) => v && expect(v).toBe(solution[i]!))
        }),
        { numRuns: 45 },
      )
    },
    TIMEOUT,
  )

  test(
    "难度评分落在所选档位",
    () => {
      fc.assert(
        fc.property(seed, difficulty, (s, d) => {
          const p = puzzleFor(s, d)
          expect(inBand(rate(parseGrid(p.givens)), d)).toBe(true)
        }),
        { numRuns: 45 },
      )
    },
    TIMEOUT,
  )

  test("同一种子生成同一题", () => {
    fc.assert(
      fc.property(seed, (s) => {
        expect(generate(s, "easy")).toEqual(generate(s, "easy"))
      }),
      { numRuns: 20 },
    )
  })
})

describe("内核", () => {
  const easy = puzzleFor("properties", "easy")

  function inBounds(state: State) {
    expect(state.values).toHaveLength(81)
    expect(state.notes).toHaveLength(81)
    state.values.forEach((v, i) => {
      expect(Number.isInteger(v) && v >= 0 && v <= 9).toBe(true)
      if (state.givens[i]) expect(v).toBe(state.givens[i]!)
    })
    state.notes.forEach((n) => expect(Number.isInteger(n) && n >= 0 && n <= 511).toBe(true))
    expect(state.hints).toBeGreaterThanOrEqual(0)
  }

  test("任意命令序列都不会抛异常或让状态越界", () => {
    fc.assert(
      fc.property(commands, (list) => {
        let state = kernel.start(easy)
        for (const c of list) {
          state = kernel.apply(state, c)
          inBounds(state)
        }
      }),
      { numRuns: 300 },
    )
  })

  test("同一命令序列重演两次，哈希相同", () => {
    fc.assert(
      fc.property(commands, (list) => {
        const r: Replay = {
          kernelVersion: kernel.version,
          generatorVersion: 1,
          seed: "properties",
          options: { difficulty: "easy" },
          commands: list,
        }
        expect(kernel.hash(replay(r, easy)!)).toBe(kernel.hash(replay(r, easy)!))
      }),
      { numRuns: 200 },
    )
  })

  test("撤销到底回到开局盘面", () => {
    fc.assert(
      fc.property(commands, (list) => {
        let state = kernel.start(easy)
        let ms = 0
        for (const c of list) state = kernel.apply(state, c)
        if (state.solvedMs !== null) return
        ms = state.ms
        while (state.past.length) state = kernel.apply(state, { t: "undo", ms: ++ms })
        expect(state.values).toEqual(state.givens)
        expect(state.notes.every((n) => n === 0)).toBe(true)
      }),
      { numRuns: 200 },
    )
  })

  test("内核版本不一致的 Replay 不重演", () => {
    expect(
      replay({
        kernelVersion: kernel.version + 1,
        generatorVersion: 1,
        seed: "x",
        options: { difficulty: "easy" },
        commands: [],
      }),
    ).toBeNull()
    expect(
      replay({
        kernelVersion: kernel.version,
        generatorVersion: 999,
        seed: "x",
        options: { difficulty: "easy" },
        commands: [],
      }),
    ).toBeNull()
  })
})
