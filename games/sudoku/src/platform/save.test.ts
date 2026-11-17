import { describe, expect, test } from "bun:test"
import fc from "fast-check"
import { SCHEMAS, upgrade, type Schema } from "./save"

/** 一份虚构的三版本 schema，用来测试迁移链本身。 */
interface V3 {
  difficulty: string
  hints: number
  stats: { wins: number }
}
const chain: Schema<V3> = {
  version: 3,
  migrations: {
    1: (d) => ({ ...(d as object), hints: 0 }),
    2: (d) => {
      const { wins, ...rest } = d as { wins?: number }
      return { ...rest, stats: { wins: wins ?? 0 } }
    },
  },
  validate: (d): d is V3 =>
    typeof d === "object" &&
    d !== null &&
    typeof (d as V3).difficulty === "string" &&
    typeof (d as V3).hints === "number" &&
    typeof (d as V3).stats?.wins === "number",
  fallback: () => ({ difficulty: "easy", hints: 0, stats: { wins: 0 } }),
}

describe("迁移链", () => {
  test("从 v1 逐级升级到 v3", () => {
    expect(upgrade({ v: 1, data: { difficulty: "hard", wins: 3 } }, chain)).toEqual({
      difficulty: "hard",
      hints: 0,
      stats: { wins: 3 },
    })
    expect(upgrade({ v: 2, data: { difficulty: "hard", hints: 2 } }, chain)).toEqual({
      difficulty: "hard",
      hints: 2,
      stats: { wins: 0 },
    })
  })

  test("缺失、更新的版本、坏数据都退回默认值", () => {
    expect(upgrade(null, chain)).toEqual(chain.fallback())
    expect(upgrade({ v: 4, data: {} }, chain)).toEqual(chain.fallback())
    expect(upgrade({ v: 1, data: 42 }, chain)).toEqual(chain.fallback())
    expect(upgrade({ v: 1.5, data: {} }, chain)).toEqual(chain.fallback())
  })

  test("任意旧版本的任意数据都能完成迁移链，不抛异常，结果通过校验", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1, max: 5 }), fc.anything(), (v, data) => {
        expect(chain.validate(upgrade({ v, data }, chain))).toBe(true)
      }),
      { numRuns: 500 },
    )
  })
})

describe("实际 Save key", () => {
  for (const [key, schema] of Object.entries(SCHEMAS) as [string, Schema<unknown>][]) {
    test(`${key}：任意数据都得到合法值`, () => {
      fc.assert(
        fc.property(fc.anything(), fc.integer({ min: 0, max: 3 }), (data, v) => {
          expect(schema.validate(upgrade({ v, data }, schema))).toBe(true)
          expect(schema.validate(upgrade(data, schema))).toBe(true)
        }),
        { numRuns: 300 },
      )
    })
  }

  test("合法数据原样读出", () => {
    expect(upgrade({ v: 1, data: { difficulty: "hard" } }, SCHEMAS.settings)).toEqual({ difficulty: "hard" })
    expect(upgrade({ v: 1, data: { "2026-11-17": { ms: 1000, hints: 0 } } }, SCHEMAS.daily)).toEqual({
      "2026-11-17": { ms: 1000, hints: 0 },
    })
    expect(upgrade({ v: 1, data: { "17-11-2026": { ms: 1000, hints: 0 } } }, SCHEMAS.daily)).toEqual({})
    const replay = { kernelVersion: 1, generatorVersion: 1, seed: "a", options: { difficulty: "easy" }, commands: [] }
    expect(upgrade({ v: 1, data: { replay, elapsedMs: 90_000 } }, SCHEMAS.current)).toEqual({
      replay,
      elapsedMs: 90_000,
    })
    expect(upgrade({ v: 1, data: replay }, SCHEMAS.current)).toBeNull()
  })
})
