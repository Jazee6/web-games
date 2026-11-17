/**
 * Dancing Links（Algorithm X）求解数独的精确覆盖，用于唯一解校验。
 * 324 列 = 81 格 × 1 + 9 行 × 9 数 + 9 列 × 9 数 + 9 宫 × 9 数；每个（格, 数）是一行，覆盖 4 列。
 */
import { CELLS, boxOf, colOf, rowOf } from "./grid"

const COLUMNS = 324
const MAX_NODES = 1 + COLUMNS + CELLS * 9 * 4

/** 统计解的个数，数到 limit 为止。givens 中 0 表示空格；给定数字互相冲突时返回 0。 */
export function countSolutions(givens: readonly number[], limit = 2): number {
  return search(givens, limit, null)
}

/** 返回唯一解之一（找不到时返回 null）。 */
export function solve(givens: readonly number[]): number[] | null {
  const out: number[] = []
  return search(givens, 1, out) > 0 ? out : null
}

function search(givens: readonly number[], limit: number, out: number[] | null): number {
  const L = new Int32Array(MAX_NODES)
  const R = new Int32Array(MAX_NODES)
  const U = new Int32Array(MAX_NODES)
  const D = new Int32Array(MAX_NODES)
  const C = new Int32Array(MAX_NODES)
  const S = new Int32Array(COLUMNS + 1)
  /** 节点所在的（格 × 9 + 数 − 1）。 */
  const ROW = new Int32Array(MAX_NODES)

  for (let i = 0; i <= COLUMNS; i++) {
    L[i] = i - 1
    R[i] = i + 1
    U[i] = i
    D[i] = i
  }
  L[0] = COLUMNS
  R[COLUMNS] = 0
  let size = COLUMNS + 1

  const addRow = (cell: number, digit: number) => {
    const r = rowOf(cell)
    const c = colOf(cell)
    const cols = [
      1 + cell,
      1 + 81 + r * 9 + digit - 1,
      1 + 162 + c * 9 + digit - 1,
      1 + 243 + boxOf(cell) * 9 + digit - 1,
    ]
    const first = size
    for (let k = 0; k < 4; k++) {
      const col = cols[k]!
      const n = size++
      C[n] = col
      ROW[n] = cell * 9 + digit - 1
      U[n] = U[col]!
      D[n] = col
      D[U[col]!] = n
      U[col] = n
      S[col]!++
      L[n] = k === 0 ? n : n - 1
      R[n] = first
      if (k > 0) R[n - 1] = n
      L[first] = n
    }
  }

  const cover = (col: number) => {
    R[L[col]!] = R[col]!
    L[R[col]!] = L[col]!
    for (let i = D[col]!; i !== col; i = D[i]!) {
      for (let j = R[i]!; j !== i; j = R[j]!) {
        D[U[j]!] = D[j]!
        U[D[j]!] = U[j]!
        S[C[j]!]!--
      }
    }
  }
  const uncover = (col: number) => {
    for (let i = U[col]!; i !== col; i = U[i]!) {
      for (let j = L[i]!; j !== i; j = L[j]!) {
        S[C[j]!]!++
        D[U[j]!] = j
        U[D[j]!] = j
      }
    }
    R[L[col]!] = col
    L[R[col]!] = col
  }

  // 已给出的格子只加一行，然后预先选中。
  const preselected: number[] = []
  for (let cell = 0; cell < CELLS; cell++) {
    const given = givens[cell]!
    if (given) {
      preselected.push(size)
      addRow(cell, given)
    } else {
      for (let d = 1; d <= 9; d++) addRow(cell, d)
    }
  }
  const covered = new Uint8Array(COLUMNS + 1)
  for (const node of preselected) {
    let j = node
    do {
      if (covered[C[j]!]) return 0 // 给定数字互相冲突
      covered[C[j]!] = 1
      cover(C[j]!)
      j = R[j]!
    } while (j !== node)
  }

  const chosen: number[] = []
  let count = 0
  const recurse = (): boolean => {
    if (R[0] === 0) {
      count++
      if (out && count === 1) {
        for (let cell = 0; cell < CELLS; cell++) out[cell] = givens[cell]!
        for (const node of chosen) out[Math.floor(ROW[node]! / 9)] = (ROW[node]! % 9) + 1
      }
      return count >= limit
    }
    let col = R[0]!
    for (let j = R[col]!; j !== 0; j = R[j]!) if (S[j]! < S[col]!) col = j
    if (S[col] === 0) return false
    cover(col)
    for (let r = D[col]!; r !== col; r = D[r]!) {
      chosen.push(r)
      for (let j = R[r]!; j !== r; j = R[j]!) cover(C[j]!)
      const done = recurse()
      for (let j = L[r]!; j !== r; j = L[j]!) uncover(C[j]!)
      chosen.pop()
      if (done) {
        uncover(col)
        return true
      }
    }
    uncover(col)
    return false
  }
  recurse()
  return count
}
