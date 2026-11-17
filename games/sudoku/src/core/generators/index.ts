/**
 * 生成器版本表。新增版本时只在这里登记，旧版本文件保持冻结。
 */
import type { Difficulty, Puzzle } from "../puzzle"
import * as v1 from "./v1"

export type Generator = (seed: string, difficulty: Difficulty) => Puzzle

export const GENERATORS: Readonly<Record<number, Generator>> = {
  [v1.VERSION]: v1.generate,
}

/** 随机开局使用的版本。 */
export const LATEST_GENERATOR = v1.VERSION
