import { describe, expect, test } from "bun:test"
import { checkCoreSource } from "./check-core"

const coreDir = "/g/src/core"
const check = (source: string, file = "/g/src/core/kernel.ts") => checkCoreSource(source, file, coreDir)

describe("checkCoreSource", () => {
  test("允许纯计算代码", () => {
    const source = `
      import { next } from "./rng"
      import type { Seed } from "../platform/types"
      import data from "./fixtures/replays/a.json"
      /** Math.sin 只出现在注释里 ** 不算 */
      export const f = (x: number, date: number) =>
        Math.sqrt(x) + Math.imul(x, 3) + Math.floor(x / 2) + date + state.window + "Date.now()".length
    `
    expect(check(source)).toEqual([])
  })

  test("拦截不确定的 Math 方法", () => {
    expect(check("export const a = Math.random()")).toEqual(["禁止 Math.random，改用 core/math.ts 或 core/rng.ts"])
    expect(check("export const a = Math.sin(1) + Math['pow'](2, 3)")).toHaveLength(2)
  })

  test("拦截 ** 运算符", () => {
    expect(check("export const a = (x: number) => x ** 2")).toEqual(["禁止 ** 运算符，改用 core/math.ts"])
  })

  test("拦截宿主全局与 locale 方法", () => {
    expect(check("export const a = Date.now()")).toEqual(["禁止使用全局 Date"])
    expect(check("export const a = () => window.innerWidth + performance.now()")).toHaveLength(2)
    expect(check("export const a = (x: string[]) => x.sort((p, q) => p.localeCompare(q))")).toEqual([
      "禁止 localeCompare，结果依赖运行环境的 locale",
    ])
  })

  test("拦截越界 import", () => {
    expect(check(`import { x } from "../view/board"; export const y = x`)).toEqual([
      '不得 import core 以外的模块："../view/board"',
    ])
    expect(check(`import { createStore } from "solid-js/store"; export const y = createStore`)).toEqual([
      '不得 import 包或外部模块："solid-js/store"',
    ])
    expect(check(`import { a } from "../rng"; export const b = a`, "/g/src/core/generators/v1.ts")).toEqual([])
  })
})
