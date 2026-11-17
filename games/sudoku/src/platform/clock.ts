/**
 * 有效用时：自开局起、扣除暂停后的毫秒数。附加在每条命令上（dom.md 第 6 节）。
 * 外层可以读时钟；内核不读。
 */
export function createClock(now: () => number = () => performance.now()) {
  let base = 0
  let startedAt: number | null = null
  return {
    /** 重新开始计时，从 offset 毫秒起（恢复 Save 时为已用时间）。 */
    reset(offset = 0) {
      base = offset
      startedAt = null
    },
    start() {
      if (startedAt === null) startedAt = now()
    },
    stop() {
      if (startedAt === null) return
      base += now() - startedAt
      startedAt = null
    },
    get running() {
      return startedAt !== null
    },
    elapsed(): number {
      return Math.floor(base + (startedAt === null ? 0 : now() - startedAt))
    },
  }
}
export type Clock = ReturnType<typeof createClock>
