/** 生成 Worker 的请求 / 响应类型，主线程与 Worker 共用。 */
import type { Puzzle } from "../core/puzzle"
import type { Replay } from "../core/replay"

export interface GenerateRequest {
  id: number
  setup: Pick<Replay, "generatorVersion" | "seed" | "options">
}

export type GenerateResponse = { id: number; puzzle: Puzzle } | { id: number; error: string }
