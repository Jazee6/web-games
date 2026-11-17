/**
 * 只使用人类技巧的逻辑求解器：给题目打分（generators/），也为提示找下一步（kernel.ts）。
 *
 * 每一步按技巧等级从低到高尝试，第一个取得进展（填数或排除候选）的技巧计一次使用，然后从头再来。
 * 只靠这些技巧推不下去的题目视为“需要猜测”，生成器不收录。
 */
import { ALL_DIGITS, bit, lowestDigit, popcount } from "./math"
import { BOXES, CELLS, COLS, PEERS, ROWS, UNITS, boxOf, colOf, isPeer, rowOf } from "./grid"

export const TECHNIQUES = [
  "hiddenSingle",
  "nakedSingle",
  "pointing",
  "boxLine",
  "nakedPair",
  "hiddenPair",
  "nakedTriple",
  "hiddenTriple",
  "xWing",
  "yWing",
] as const
export type Technique = (typeof TECHNIQUES)[number]

/** 技巧等级：1 = singles；2 = 区块与数对；3 = 三数组、X-Wing、Y-Wing。 */
export const TECHNIQUE_LEVEL: Record<Technique, 1 | 2 | 3> = {
  hiddenSingle: 1,
  nakedSingle: 1,
  pointing: 2,
  boxLine: 2,
  nakedPair: 2,
  hiddenPair: 2,
  nakedTriple: 3,
  hiddenTriple: 3,
  xWing: 3,
  yWing: 3,
}

/** 计分权重：越难的技巧每次使用分越高。 */
const TECHNIQUE_WEIGHT: Record<Technique, number> = {
  hiddenSingle: 1,
  nakedSingle: 2,
  pointing: 8,
  boxLine: 8,
  nakedPair: 10,
  hiddenPair: 12,
  nakedTriple: 20,
  hiddenTriple: 24,
  xWing: 28,
  yWing: 30,
}

export interface Rating {
  /** 是否只靠上面的技巧就能解出。 */
  solved: boolean
  /** 用到的最高技巧等级；解不出时为 0。 */
  level: number
  /** 最高等级技巧的使用次数。 */
  levelUses: number
  /** Σ 权重 × 使用次数。 */
  score: number
  uses: Partial<Record<Technique, number>>
}

/** 求解过程中的盘面：values 为已填数字，cand 为空格的候选掩码。 */
interface Board {
  values: number[]
  cand: number[]
}

function createBoard(grid: readonly number[]): Board {
  const values = grid.slice()
  const cand = Array.from({ length: CELLS }, () => 0)
  for (let cell = 0; cell < CELLS; cell++) {
    if (values[cell]) continue
    let mask = ALL_DIGITS
    for (const p of PEERS[cell]!) if (values[p]) mask &= ~bit(values[p]!)
    cand[cell] = mask
  }
  return { values, cand }
}

function place(board: Board, cell: number, digit: number) {
  board.values[cell] = digit
  board.cand[cell] = 0
  const b = bit(digit)
  for (const p of PEERS[cell]!) board.cand[p]! &= ~b
}

/** 从 cells 中排除 mask，返回是否有变化。 */
function eliminate(board: Board, cells: Iterable<number>, mask: number): boolean {
  let changed = false
  for (const cell of cells) {
    const before = board.cand[cell]!
    if (before & mask) {
      board.cand[cell] = before & ~mask
      changed = true
    }
  }
  return changed
}

/** 一步推理的结果：填了哪个格子（如果有）。 */
type Step = { placed: { cell: number; digit: number } | null } | null

type Finder = (board: Board) => Step

/** 单元中可以放 digit 的空格。 */
function positions(board: Board, unit: readonly number[], digit: number): number[] {
  const b = bit(digit)
  const out: number[] = []
  for (const cell of unit) if (board.cand[cell]! & b) out.push(cell)
  return out
}

const hiddenSingle: Finder = (board) => {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const pos = positions(board, unit, d)
      if (pos.length === 1) {
        place(board, pos[0]!, d)
        return { placed: { cell: pos[0]!, digit: d } }
      }
    }
  }
  return null
}

const nakedSingle: Finder = (board) => {
  for (let cell = 0; cell < CELLS; cell++) {
    const mask = board.cand[cell]!
    if (!board.values[cell] && popcount(mask) === 1) {
      const digit = lowestDigit(mask)
      place(board, cell, digit)
      return { placed: { cell, digit } }
    }
  }
  return null
}

/** 宫内某数字只在一行（列）上 → 该行（列）宫外排除。 */
const pointing: Finder = (board) => {
  for (const box of BOXES) {
    for (let d = 1; d <= 9; d++) {
      const pos = positions(board, box, d)
      if (pos.length < 2) continue
      const r = rowOf(pos[0]!)
      const c = colOf(pos[0]!)
      const b = boxOf(pos[0]!)
      if (
        pos.every((p) => rowOf(p) === r) &&
        eliminate(
          board,
          ROWS[r]!.filter((x) => boxOf(x) !== b),
          bit(d),
        )
      )
        return { placed: null }
      if (
        pos.every((p) => colOf(p) === c) &&
        eliminate(
          board,
          COLS[c]!.filter((x) => boxOf(x) !== b),
          bit(d),
        )
      )
        return { placed: null }
    }
  }
  return null
}

/** 行（列）内某数字只在一个宫里 → 该宫行（列）外排除。 */
const boxLine: Finder = (board) => {
  for (const line of [...ROWS, ...COLS]) {
    for (let d = 1; d <= 9; d++) {
      const pos = positions(board, line, d)
      if (pos.length < 2) continue
      const b = boxOf(pos[0]!)
      if (!pos.every((p) => boxOf(p) === b)) continue
      if (
        eliminate(
          board,
          BOXES[b]!.filter((x) => !line.includes(x)),
          bit(d),
        )
      )
        return { placed: null }
    }
  }
  return null
}

/** 所有大小为 k 的组合（下标），按字典序。 */
function combinations(n: number, k: number): number[][] {
  const out: number[][] = []
  const pick: number[] = []
  const walk = (start: number) => {
    if (pick.length === k) {
      out.push(pick.slice())
      return
    }
    for (let i = start; i < n; i++) {
      pick.push(i)
      walk(i + 1)
      pick.pop()
    }
  }
  walk(0)
  return out
}

/** k 个格子的候选并集恰好 k 个数字 → 单元内其余格子排除这些数字。 */
function nakedSubset(k: number): Finder {
  return (board) => {
    for (const unit of UNITS) {
      const empty = unit.filter((cell) => !board.values[cell] && popcount(board.cand[cell]!) <= k)
      if (empty.length < k) continue
      for (const combo of combinations(empty.length, k)) {
        const cells = combo.map((i) => empty[i]!)
        let union = 0
        for (const cell of cells) union |= board.cand[cell]!
        if (popcount(union) !== k) continue
        const others = unit.filter((cell) => !board.values[cell] && !cells.includes(cell))
        if (eliminate(board, others, union)) return { placed: null }
      }
    }
    return null
  }
}

/** k 个数字在单元内只出现在同样 k 个格子 → 这些格子排除其他数字。 */
function hiddenSubset(k: number): Finder {
  return (board) => {
    for (const unit of UNITS) {
      const digits: number[] = []
      const where: number[][] = []
      for (let d = 1; d <= 9; d++) {
        const pos = positions(board, unit, d)
        if (pos.length >= 2 && pos.length <= k) {
          digits.push(d)
          where.push(pos)
        }
      }
      if (digits.length < k) continue
      for (const combo of combinations(digits.length, k)) {
        const cells = new Set<number>()
        let mask = 0
        for (const i of combo) {
          mask |= bit(digits[i]!)
          for (const cell of where[i]!) cells.add(cell)
        }
        if (cells.size !== k) continue
        if (eliminate(board, cells, ALL_DIGITS & ~mask)) return { placed: null }
      }
    }
    return null
  }
}

/** 某数字在两行中都只出现在同样两列 → 这两列的其他行排除（以及行列互换）。 */
const xWing: Finder = (board) => {
  for (let d = 1; d <= 9; d++) {
    for (const [lines, cross, indexOf] of [
      [ROWS, COLS, colOf],
      [COLS, ROWS, rowOf],
    ] as const) {
      const pairs: { line: number; a: number; b: number }[] = []
      for (let i = 0; i < 9; i++) {
        const pos = positions(board, lines[i]!, d)
        if (pos.length === 2) pairs.push({ line: i, a: indexOf(pos[0]!), b: indexOf(pos[1]!) })
      }
      for (let i = 0; i < pairs.length; i++) {
        for (let j = i + 1; j < pairs.length; j++) {
          const p = pairs[i]!
          const q = pairs[j]!
          if (p.a !== q.a || p.b !== q.b) continue
          const targets = [...cross[p.a]!, ...cross[p.b]!].filter((cell) => {
            const line = lines === ROWS ? rowOf(cell) : colOf(cell)
            return line !== p.line && line !== q.line
          })
          if (eliminate(board, targets, bit(d))) return { placed: null }
        }
      }
    }
  }
  return null
}

/** 枢纽 {a,b}，两个钳子 {a,c}、{b,c} 都与枢纽同组 → 同时与两钳同组的格子排除 c。 */
const yWing: Finder = (board) => {
  const bivalue: number[] = []
  for (let cell = 0; cell < CELLS; cell++)
    if (!board.values[cell] && popcount(board.cand[cell]!) === 2) bivalue.push(cell)
  for (const pivot of bivalue) {
    const pm = board.cand[pivot]!
    const wings = bivalue.filter((w) => isPeer(pivot, w) && popcount(board.cand[w]! & pm) === 1)
    for (let i = 0; i < wings.length; i++) {
      for (let j = i + 1; j < wings.length; j++) {
        const x = wings[i]!
        const y = wings[j]!
        const xm = board.cand[x]!
        const ym = board.cand[y]!
        const c = xm & ~pm
        if (c === 0 || c !== (ym & ~pm) || (xm & pm) === (ym & pm)) continue
        const targets = PEERS[x]!.filter((cell) => cell !== y && cell !== pivot && isPeer(cell, y))
        if (eliminate(board, targets, c)) return { placed: null }
      }
    }
  }
  return null
}

const FINDERS: [Technique, Finder][] = [
  ["hiddenSingle", hiddenSingle],
  ["nakedSingle", nakedSingle],
  ["pointing", pointing],
  ["boxLine", boxLine],
  ["nakedPair", nakedSubset(2)],
  ["hiddenPair", hiddenSubset(2)],
  ["nakedTriple", nakedSubset(3)],
  ["hiddenTriple", hiddenSubset(3)],
  ["xWing", xWing],
  ["yWing", yWing],
]

function nextStep(board: Board, maxLevel: number): { technique: Technique; step: NonNullable<Step> } | null {
  for (const [technique, find] of FINDERS) {
    if (TECHNIQUE_LEVEL[technique] > maxLevel) break
    const step = find(board)
    if (step) return { technique, step }
  }
  return null
}

const isFull = (board: Board) => board.values.every((v) => v !== 0)

/**
 * 给题目打分。maxLevel 用于生成时提前放弃：需要更高等级技巧时直接返回 solved: false。
 * 调用方保证题目有唯一解（DLX 已校验），否则结果没有意义。
 */
export function rate(grid: readonly number[], maxLevel = 3): Rating {
  const board = createBoard(grid)
  const uses: Partial<Record<Technique, number>> = {}
  while (!isFull(board)) {
    const next = nextStep(board, maxLevel)
    if (!next) return { solved: false, level: 0, levelUses: 0, score: 0, uses }
    uses[next.technique] = (uses[next.technique] ?? 0) + 1
  }
  let level = 0
  let levelUses = 0
  let score = 0
  for (const technique of TECHNIQUES) {
    const n = uses[technique] ?? 0
    if (!n) continue
    score += TECHNIQUE_WEIGHT[technique] * n
    const l = TECHNIQUE_LEVEL[technique]
    if (l > level) {
      level = l
      levelUses = 0
    }
    if (l === level) levelUses += n
  }
  return { solved: true, level, levelUses, score, uses }
}

/**
 * 从当前盘面找下一个能推出的格子（提示）。technique 是这一步推理链中最难的技巧。
 * 推不出时返回 null。
 */
export function nextPlacement(grid: readonly number[]): { cell: number; digit: number; technique: Technique } | null {
  const board = createBoard(grid)
  let hardest: Technique | null = null
  while (!isFull(board)) {
    const next = nextStep(board, 3)
    if (!next) return null
    if (!hardest || TECHNIQUE_LEVEL[next.technique] > TECHNIQUE_LEVEL[hardest]) hardest = next.technique
    if (next.step.placed) return { ...next.step.placed, technique: hardest }
  }
  return null
}
