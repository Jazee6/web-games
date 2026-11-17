import { expect, test } from "bun:test"
import { parseGrid } from "./grid"
import { nextPlacement, rate } from "./logic"

// 只靠 singles 就能解出的经典题。
const SINGLES = "530070000600195000098000060800060003400803001700020006060000280000419005000080079"
const SINGLES_SOLUTION = "534678912672195348198342567859761423426853791713924856961537284287419635345286179"
// 需要 X-Wing 等进阶技巧、singles 推不下去的题。
const XWING = "100000569492056108056109240009640801064010000218035604040500016905061402621000005"

test("singles 题评为 1 级", () => {
  const rating = rate(parseGrid(SINGLES))
  expect(rating.solved).toBe(true)
  expect(rating.level).toBe(1)
  expect(rating.score).toBeGreaterThan(0)
})

test("只允许 1 级技巧时，进阶题判为解不出", () => {
  expect(rate(parseGrid(XWING), 1).solved).toBe(false)
  const full = rate(parseGrid(XWING), 3)
  expect(full.solved).toBe(true)
  expect(full.level).toBeGreaterThan(1)
})

test("提示给出的格子与答案一致", () => {
  const grid = parseGrid(SINGLES)
  for (let i = 0; i < 81; i++) {
    const next = nextPlacement(grid)
    if (!next) break
    expect(next.digit).toBe(Number(SINGLES_SOLUTION[next.cell]))
    grid[next.cell] = next.digit
  }
  expect(grid.join("")).toBe(SINGLES_SOLUTION)
})
