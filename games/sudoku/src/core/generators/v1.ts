/**
 * 生成器 v1。**已发布后只能新增 v2，不能修改本文件**：历史 Daily Puzzle 与 Replay 依赖它（回放金标锁定）。
 *
 * 1. 用种子随机回溯填出完整解。
 * 2. 按随机顺序逐格挖空：每挖一格先用 DLX 校验唯一解，再用逻辑求解器确认不需要超出本档的技巧，否则放回。
 * 3. 挖完后打分，落在本档区间就收下；否则换下一个完整解重来，最多 MAX_ATTEMPTS 次。
 */
import { countSolutions } from "../dlx"
import { CELLS, PEERS, formatGrid } from "../grid"
import { rate, type Rating } from "../logic"
import { bit, ALL_DIGITS } from "../math"
import { BANDS, inBand, type Difficulty, type Puzzle } from "../puzzle"
import { createRng, type Rng } from "../rng"

export const VERSION = 1
const MAX_ATTEMPTS = 40

export function generate(seed: string, difficulty: Difficulty): Puzzle {
  const rng = createRng(`sudoku/v1/${difficulty}/${seed}`)
  const band = BANDS[difficulty]
  let best: { givens: number[]; solution: number[]; rating: Rating } | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const solution = fillGrid(rng)
    const givens = solution.slice()
    let count = CELLS
    for (const cell of rng.shuffle(Array.from({ length: CELLS }, (_, i) => i))) {
      if (count <= band.minGivens) break
      const digit = givens[cell]!
      givens[cell] = 0
      if (countSolutions(givens, 2) === 1 && rate(givens, band.level).solved) count--
      else givens[cell] = digit
    }
    const rating = rate(givens, band.level)
    if (inBand(rating, difficulty)) return toPuzzle(givens, solution, difficulty, rating)
    // 兜底：保留最接近本档的一次（等级更高、同等级下使用次数更多）。
    if (!best || closer(rating, best.rating)) best = { givens, solution, rating }
  }
  return toPuzzle(best!.givens, best!.solution, difficulty, best!.rating)
}

function closer(a: Rating, b: Rating) {
  return a.level !== b.level ? a.level > b.level : a.levelUses > b.levelUses
}

function toPuzzle(givens: number[], solution: number[], difficulty: Difficulty, rating: Rating): Puzzle {
  return { givens: formatGrid(givens), solution: formatGrid(solution), difficulty, score: rating.score }
}

/** 随机回溯填满网格：每次选候选最少的格子，候选按随机顺序尝试。 */
function fillGrid(rng: Rng): number[] {
  const grid = Array.from({ length: CELLS }, () => 0)
  const walk = (): boolean => {
    let target = -1
    let targetMask = 0
    let fewest = 10
    for (let cell = 0; cell < CELLS; cell++) {
      if (grid[cell]) continue
      let mask = ALL_DIGITS
      for (const p of PEERS[cell]!) if (grid[p]) mask &= ~bit(grid[p]!)
      let n = 0
      for (let d = 1; d <= 9; d++) if (mask & bit(d)) n++
      if (n < fewest) {
        fewest = n
        target = cell
        targetMask = mask
        if (n === 0) return false
      }
    }
    if (target < 0) return true
    const digits: number[] = []
    for (let d = 1; d <= 9; d++) if (targetMask & bit(d)) digits.push(d)
    for (const d of rng.shuffle(digits)) {
      grid[target] = d
      if (walk()) return true
    }
    grid[target] = 0
    return false
  }
  walk()
  return grid
}
