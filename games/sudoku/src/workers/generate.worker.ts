/**
 * 题目生成 Worker：只做消息收发，生成逻辑全在 core/。权威状态始终在主线程的内核里。
 */
import { replayPuzzle } from "../core/replay"
import type { GenerateRequest, GenerateResponse } from "./protocol"

interface WorkerScope {
  onmessage: ((event: MessageEvent<GenerateRequest>) => void) | null
  postMessage(message: GenerateResponse): void
}

const scope = self as unknown as WorkerScope

scope.onmessage = ({ data }) => {
  try {
    scope.postMessage({ id: data.id, puzzle: replayPuzzle(data.setup) })
  } catch (error) {
    scope.postMessage({ id: data.id, error: String(error) })
  }
}
