/**
 * 9 × 9 网格的几何：格子编号 0–80（行优先），27 个单元（9 行、9 列、9 宫）与每格的 20 个同组格。
 */

export const SIZE = 9
export const CELLS = 81

export type Grid = number[]

export const rowOf = (cell: number) => Math.floor(cell / 9)
export const colOf = (cell: number) => cell % 9
export const boxOf = (cell: number) => Math.floor(rowOf(cell) / 3) * 3 + Math.floor(colOf(cell) / 3)

const range = (n: number) => Array.from({ length: n }, (_, i) => i)

export const ROWS: readonly (readonly number[])[] = range(9).map((r) => range(9).map((c) => r * 9 + c))
export const COLS: readonly (readonly number[])[] = range(9).map((c) => range(9).map((r) => r * 9 + c))
export const BOXES: readonly (readonly number[])[] = range(9).map((b) =>
  range(9).map((i) => (Math.floor(b / 3) * 3 + Math.floor(i / 3)) * 9 + (b % 3) * 3 + (i % 3)),
)
/** 行、列、宫，顺序固定。 */
export const UNITS: readonly (readonly number[])[] = [...ROWS, ...COLS, ...BOXES]

export const PEERS: readonly (readonly number[])[] = range(CELLS).map((cell) =>
  range(CELLS).filter(
    (other) =>
      other !== cell && (rowOf(other) === rowOf(cell) || colOf(other) === colOf(cell) || boxOf(other) === boxOf(cell)),
  ),
)

export function isPeer(a: number, b: number): boolean {
  return a !== b && (rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b))
}

/** "530070000…" ↔ 数组，0 表示空格。 */
export function parseGrid(text: string): Grid {
  if (text.length !== CELLS || !/^[0-9]+$/.test(text)) throw new Error("grid must be 81 digits")
  return Array.from(text, (ch) => ch.charCodeAt(0) - 48)
}

export function formatGrid(grid: readonly number[]): string {
  return grid.join("")
}
