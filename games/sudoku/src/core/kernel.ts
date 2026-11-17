/**
 * Sudoku Kernel（ADR-0004）：纯 reducer，不可变状态。状态 = f(题目, 命令序列)。
 * 胜负判定、提示都在这里；冲突高亮等纯展示的派生量在视图里算。
 * 内核只产出消息 key（technique），不产出文案。
 */
import { isCommand, type Command } from "./commands"
import { GENERATORS, LATEST_GENERATOR } from "./generators"
import { CELLS, PEERS, parseGrid } from "./grid"
import { nextPlacement, type Technique } from "./logic"
import { bit } from "./math"
import type { Difficulty, Puzzle } from "./puzzle"
import { hashHex } from "./rng"

/** [格子, 原数字, 原草稿, 新数字, 新草稿] */
export type Change = readonly [number, number, number, number, number]
/** 一次可撤销的操作，可能同时改动多个格子（填数时顺带清掉同组格子的同数字草稿）。 */
export type Edit = readonly Change[]

export type HintResult =
  /** 盘面上有填错的数字，先指出它。 */
  | { kind: "mistake"; cell: number }
  /** 填入一个能推出的格子；technique 为 null 表示逻辑推不出，直接揭示答案。 */
  | { kind: "placement"; cell: number; digit: number; technique: Technique | null }

export interface State {
  readonly difficulty: Difficulty
  readonly givens: readonly number[]
  readonly solution: readonly number[]
  /** 0 为空格。给定格与 givens 相同。 */
  readonly values: readonly number[]
  /** 草稿位掩码，位 d−1 表示数字 d。 */
  readonly notes: readonly number[]
  readonly past: readonly Edit[]
  readonly future: readonly Edit[]
  /** 提示使用次数。 */
  readonly hints: number
  /** 最近一次提示的结果，下一次改动盘面后清空。 */
  readonly hint: HintResult | null
  /** 最近一条生效命令的 ms。 */
  readonly ms: number
  /** 完成时的 ms；未完成为 null。完成后忽略所有命令。 */
  readonly solvedMs: number | null
}

export interface Options {
  difficulty: Difficulty
  generatorVersion: number
}

export interface Kernel<S, C, O> {
  readonly version: number
  init(seed: string, options: O): S
  apply(state: S, command: C): S
  hash(state: S): string
}

/** 规则一改就递增；旧 Replay 记录了它，不一致时作废。 */
export const KERNEL_VERSION = 1

export const kernel: Kernel<State, Command, Options> & { start(puzzle: Puzzle): State } = {
  version: KERNEL_VERSION,
  init(seed, options) {
    const generate = GENERATORS[options.generatorVersion] ?? GENERATORS[LATEST_GENERATOR]!
    return start(generate(seed, options.difficulty))
  },
  start,
  apply,
  hash,
}

/** 用已生成的题目开局（生成在 Worker 里完成时用这个入口）。 */
function start(puzzle: Puzzle): State {
  const givens = parseGrid(puzzle.givens)
  return {
    difficulty: puzzle.difficulty,
    givens,
    solution: parseGrid(puzzle.solution),
    values: givens,
    notes: Array.from({ length: CELLS }, () => 0),
    past: [],
    future: [],
    hints: 0,
    hint: null,
    ms: 0,
    solvedMs: null,
  }
}

/** 应用一条命令。非法或无效的命令原样返回 state。 */
function apply(state: State, command: Command): State {
  if (state.solvedMs !== null || !isCommand(command)) return state
  const ms = Math.max(state.ms, command.ms)
  switch (command.t) {
    case "place":
      return commit(state, placeChanges(state, command.cell, command.digit), ms)
    case "note": {
      const { cell, digit } = command
      if (state.givens[cell] || state.values[cell]) return state
      return commit(state, [[cell, 0, state.notes[cell]!, 0, state.notes[cell]! ^ bit(digit)]], ms)
    }
    case "clear": {
      const { cell } = command
      const value = state.values[cell]!
      const notes = state.notes[cell]!
      if (state.givens[cell] || (!value && !notes)) return state
      return commit(state, [[cell, value, notes, 0, value ? notes : 0]], ms)
    }
    case "hint":
      return hint(state, ms)
    case "undo": {
      const edit = state.past.at(-1)
      if (!edit) return state
      return finish({
        ...revert(state, edit, false),
        past: state.past.slice(0, -1),
        future: [...state.future, edit],
        hint: null,
        ms,
      })
    }
    case "redo": {
      const edit = state.future.at(-1)
      if (!edit) return state
      return finish({
        ...revert(state, edit, true),
        past: [...state.past, edit],
        future: state.future.slice(0, -1),
        hint: null,
        ms,
      })
    }
  }
}

/** 填数：替换原数字、清空本格草稿，并清掉同组格子里同数字的草稿。 */
function placeChanges(state: State, cell: number, digit: number): Change[] {
  if (state.givens[cell] || state.values[cell] === digit) return []
  const changes: Change[] = [[cell, state.values[cell]!, state.notes[cell]!, digit, 0]]
  const b = bit(digit)
  for (const p of PEERS[cell]!) {
    const notes = state.notes[p]!
    if (notes & b) changes.push([p, state.values[p]!, notes, state.values[p]!, notes & ~b])
  }
  return changes
}

/** 记录一次新的可撤销操作，清空重做栈。 */
function commit(state: State, changes: Edit, ms: number, hintResult: HintResult | null = null): State {
  if (!changes.length) return state
  return finish({
    ...revert(state, changes, true),
    past: [...state.past, changes],
    future: [],
    hint: hintResult,
    ms,
  })
}

/** 把一次操作应用到盘面上：forward 为 true 时取新值，否则取原值。 */
function revert(state: State, edit: Edit, forward: boolean): State {
  const values = state.values.slice()
  const notes = state.notes.slice()
  // 撤销时倒序还原，保证同一格多次改动时结果正确。
  const ordered = forward ? edit : edit.slice().reverse()
  for (const [cell, fromValue, fromNotes, toValue, toNotes] of ordered) {
    values[cell] = forward ? toValue : fromValue
    notes[cell] = forward ? toNotes : fromNotes
  }
  return { ...state, values, notes }
}

function finish(state: State): State {
  const solved = state.values.every((v, i) => v === state.solution[i])
  return solved ? { ...state, solvedMs: state.ms } : state
}

function hint(state: State, ms: number): State {
  const hints = state.hints + 1
  const mistake = state.values.findIndex((v, i) => v !== 0 && v !== state.solution[i])
  if (mistake >= 0) return { ...state, hints, hint: { kind: "mistake", cell: mistake }, ms }

  const found = nextPlacement(state.values)
  const cell = found ? found.cell : state.values.indexOf(0)
  const digit = found ? found.digit : state.solution[cell]!
  const result: HintResult = { kind: "placement", cell, digit, technique: found ? found.technique : null }
  return commit({ ...state, hints }, placeChanges(state, cell, digit), ms, result)
}

/** 状态摘要：64 位，16 位十六进制。只依赖整数与固定顺序的 JSON，各引擎一致。 */
function hash(state: State): string {
  return hashHex(
    JSON.stringify([
      state.difficulty,
      state.givens,
      state.solution,
      state.values,
      state.notes,
      state.past,
      state.future,
      state.hints,
      state.hint,
      state.ms,
      state.solvedMs,
    ]),
  )
}
