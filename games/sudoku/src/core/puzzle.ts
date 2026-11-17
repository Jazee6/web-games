/**
 * 题目与难度档位。难度按逻辑求解器需要的最高技巧等级分档（logic.ts），不按空格数量。
 */
import type { Rating } from "./logic"

export const DIFFICULTIES = ["easy", "medium", "hard"] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export interface Band {
  /** 解题所需的最高技巧等级，必须恰好等于它。 */
  level: number
  /** 最高等级技巧至少使用的次数。 */
  minLevelUses: number
  /** 挖空时保留的最少给定数，避免 Easy 档过于空旷。 */
  minGivens: number
}

export const BANDS: Record<Difficulty, Band> = {
  easy: { level: 1, minLevelUses: 1, minGivens: 32 },
  medium: { level: 2, minLevelUses: 2, minGivens: 17 },
  hard: { level: 3, minLevelUses: 1, minGivens: 17 },
}

export function inBand(rating: Rating, difficulty: Difficulty): boolean {
  const band = BANDS[difficulty]
  return rating.solved && rating.level === band.level && rating.levelUses >= band.minLevelUses
}

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value)
}

/** 一道题。字符串形式便于序列化与比较：81 位数字，0 为空格。 */
export interface Puzzle {
  givens: string
  solution: string
  difficulty: Difficulty
  /** 难度得分（logic.ts 的 Rating.score）。 */
  score: number
}
