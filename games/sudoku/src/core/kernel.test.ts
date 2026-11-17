import { describe, expect, test } from "bun:test"
import { kernel, type State } from "./kernel"
import type { Command } from "./commands"
import type { Puzzle } from "./puzzle"
import { bit } from "./math"

const PUZZLE: Puzzle = {
  givens: "530070000600195000098000060800060003400803001700020006060000280000419005000080079",
  solution: "534678912672195348198342567859761423426853791713924856961537284287419635345286179",
  difficulty: "easy",
  score: 0,
}
const solution = Array.from(PUZZLE.solution, Number)

function run(...commands: Partial<Command>[]): State {
  let state = kernel.start(PUZZLE)
  let ms = 0
  for (const c of commands) state = kernel.apply(state, { ms: (ms += 1000), ...c } as Command)
  return state
}

describe("填数与草稿", () => {
  test("填数并清掉同组格子里同数字的草稿", () => {
    // 格 2 与格 3 同行；格 2 填 4 时，格 3 的草稿 4 被清掉
    const s = run({ t: "note", cell: 3, digit: 4 }, { t: "note", cell: 3, digit: 6 }, { t: "place", cell: 2, digit: 4 })
    expect(s.values[2]).toBe(4)
    expect(s.notes[3]).toBe(bit(6))
    expect(s.past).toHaveLength(3)
  })

  test("给定格、相同数字、有数字的格子写草稿都被忽略", () => {
    const base = run({ t: "place", cell: 2, digit: 4 })
    expect(kernel.apply(base, { t: "place", cell: 0, digit: 1, ms: 9000 })).toBe(base)
    expect(kernel.apply(base, { t: "place", cell: 2, digit: 4, ms: 9000 })).toBe(base)
    expect(kernel.apply(base, { t: "note", cell: 2, digit: 1, ms: 9000 })).toBe(base)
  })

  test("清除先清数字，数字清掉后恢复原来的草稿", () => {
    const s = run({ t: "note", cell: 2, digit: 1 }, { t: "place", cell: 2, digit: 4 }, { t: "clear", cell: 2 })
    expect(s.values[2]).toBe(0)
    expect(s.notes[2]).toBe(0)
  })
})

describe("撤销与重做", () => {
  test("撤销、重做恢复盘面与历史", () => {
    const placed = run({ t: "note", cell: 3, digit: 4 }, { t: "place", cell: 2, digit: 4 })
    const undone = kernel.apply(placed, { t: "undo", ms: 5000 })
    expect(undone.values[2]).toBe(0)
    expect(undone.notes[3]).toBe(bit(4))
    const redone = kernel.apply(undone, { t: "redo", ms: 6000 })
    expect(redone.values).toEqual(placed.values)
    expect(redone.notes).toEqual(placed.notes)
  })

  test("新操作清空重做栈", () => {
    const s = run({ t: "place", cell: 2, digit: 4 }, { t: "undo" }, { t: "place", cell: 3, digit: 6 })
    expect(s.future).toHaveLength(0)
    expect(kernel.apply(s, { t: "redo", ms: 99000 })).toBe(s)
  })
})

describe("完成与提示", () => {
  test("填满正确答案后完成，之后忽略所有命令", () => {
    const commands = solution.flatMap((d, cell) =>
      PUZZLE.givens[cell] === "0" ? [{ t: "place" as const, cell, digit: d }] : [],
    )
    const s = run(...commands)
    expect(s.solvedMs).toBe(commands.length * 1000)
    expect(kernel.apply(s, { t: "undo", ms: 1e9 })).toBe(s)
  })

  test("有填错的数字时提示先指出它，不改盘面", () => {
    const s = run({ t: "place", cell: 2, digit: 9 }, { t: "hint" })
    expect(s.hint).toEqual({ kind: "mistake", cell: 2 })
    expect(s.hints).toBe(1)
    expect(s.values[2]).toBe(9)
  })

  test("提示填入一个推得出的格子，并记录技巧", () => {
    const s = run({ t: "hint" })
    expect(s.hint?.kind).toBe("placement")
    if (s.hint?.kind !== "placement") return
    expect(s.values[s.hint.cell]).toBe(solution[s.hint.cell])
    expect(s.hint.technique).not.toBeNull()
    expect(s.past).toHaveLength(1)
  })
})

test("ms 取最大值，不倒退", () => {
  let s = kernel.start(PUZZLE)
  s = kernel.apply(s, { t: "place", cell: 2, digit: 4, ms: 5000 })
  s = kernel.apply(s, { t: "place", cell: 3, digit: 6, ms: 3000 })
  expect(s.ms).toBe(5000)
})
