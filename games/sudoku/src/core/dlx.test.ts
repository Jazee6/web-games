import { expect, test } from "bun:test"
import { countSolutions, solve } from "./dlx"
import { parseGrid } from "./grid"

const PUZZLE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079"
const SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179"

test("求出唯一解", () => {
  expect(countSolutions(parseGrid(PUZZLE))).toBe(1)
  expect(solve(parseGrid(PUZZLE))?.join("")).toBe(SOLUTION)
})

test("多解时数到上限为止", () => {
  const sparse = parseGrid(PUZZLE.replace(/[1-9]/g, (d, i: number) => (i < 30 ? d : "0")))
  expect(countSolutions(sparse, 2)).toBe(2)
  expect(
    countSolutions(
      Array.from({ length: 81 }, () => 0),
      5,
    ),
  ).toBe(5)
})

test("给定数字冲突时无解", () => {
  const grid = parseGrid(PUZZLE)
  grid[2] = 5 // 第一行已有 5
  expect(countSolutions(grid)).toBe(0)
  expect(solve(grid)).toBeNull()
})
