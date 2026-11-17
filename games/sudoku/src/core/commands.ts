/**
 * 命令：小而纯的 JSON。每条命令带 ms（自开局起、扣除暂停后的有效毫秒数，由外层计时器附加）。
 * 撤销、重做、提示也是命令，追加到同一个命令序列。
 */

export type Command =
  | { t: "place"; cell: number; digit: number; ms: number }
  /** 切换草稿数字。 */
  | { t: "note"; cell: number; digit: number; ms: number }
  /** 清除格子的数字或全部草稿。 */
  | { t: "clear"; cell: number; ms: number }
  | { t: "hint"; ms: number }
  | { t: "undo"; ms: number }
  | { t: "redo"; ms: number }

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max

/** 校验未知数据是否为合法命令。非法命令由内核忽略。 */
export function isCommand(value: unknown): value is Command {
  if (typeof value !== "object" || value === null) return false
  const c = value as Record<string, unknown>
  if (!isInt(c.ms, 0, Number.MAX_SAFE_INTEGER)) return false
  switch (c.t) {
    case "place":
    case "note":
      return isInt(c.cell, 0, 80) && isInt(c.digit, 1, 9)
    case "clear":
      return isInt(c.cell, 0, 80)
    case "hint":
    case "undo":
    case "redo":
      return true
    default:
      return false
  }
}
