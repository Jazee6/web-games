/**
 * 题目生成的主线程入口：类型化的请求 / 响应封装（不引入 Comlink）。
 * Worker 不可用或出错时退回主线程生成，代码路径一致，只是会短暂占用主线程。
 */
import type { Puzzle } from "../core/puzzle"
import { replayPuzzle } from "../core/replay"
import type { GenerateRequest, GenerateResponse } from "../workers/protocol"

type Setup = GenerateRequest["setup"]

export function createGenerator() {
  let worker: Worker | null = null
  try {
    worker = new Worker(new URL("workers/generate.worker.js", document.baseURI), { type: "module" })
  } catch {
    worker = null
  }

  let nextId = 1
  const pending = new Map<number, { setup: Setup; resolve: (p: Puzzle) => void }>()
  const fallback = (id: number) => {
    const entry = pending.get(id)
    if (!entry) return
    pending.delete(id)
    entry.resolve(replayPuzzle(entry.setup))
  }

  if (worker) {
    worker.onmessage = ({ data }: MessageEvent<GenerateResponse>) => {
      const entry = pending.get(data.id)
      if (!entry) return
      if ("puzzle" in data) {
        pending.delete(data.id)
        entry.resolve(data.puzzle)
      } else fallback(data.id)
    }
    // 加载失败（例如找不到 Worker 文件）：之后都在主线程生成。
    worker.onerror = () => {
      worker?.terminate()
      worker = null
      for (const id of pending.keys()) fallback(id)
    }
  }

  return {
    generate(setup: Setup): Promise<Puzzle> {
      const id = nextId++
      return new Promise((resolve) => {
        pending.set(id, { setup, resolve })
        if (worker) worker.postMessage({ id, setup } satisfies GenerateRequest)
        else setTimeout(() => fallback(id), 0)
      })
    },
  }
}
