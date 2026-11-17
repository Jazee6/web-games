/**
 * 输入的三层映射：原始事件 → 动作（本文件）→ 命令（controller.ts）。
 * 键盘用 KeyboardEvent.code，与键盘布局无关。
 */

export type Action =
  | { type: "move"; dr: number; dc: number }
  | { type: "digit"; digit: number; note: boolean }
  | { type: "clear" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "toggleNotes" }

export interface KeyInput {
  code: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}

const ARROWS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
}

/** 键盘事件 → 动作；不处理的键返回 null。Shift 或 Alt + 数字 = 草稿。 */
export function keyToAction(e: KeyInput): Action | null {
  const mod = e.ctrlKey || e.metaKey
  if (mod) {
    if (e.code === "KeyZ") return { type: e.shiftKey ? "redo" : "undo" }
    if (e.code === "KeyY") return { type: "redo" }
    return null
  }
  const arrow = ARROWS[e.code]
  if (arrow) return { type: "move", dr: arrow[0], dc: arrow[1] }
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code)
  if (digit) {
    const d = Number(digit[1])
    return d === 0 ? { type: "clear" } : { type: "digit", digit: d, note: e.shiftKey || e.altKey }
  }
  if (e.code === "Backspace" || e.code === "Delete") return { type: "clear" }
  if (e.code === "KeyN") return { type: "toggleNotes" }
  return null
}
