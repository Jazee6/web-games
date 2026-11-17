import { expect, test } from "bun:test"
import { keyToAction } from "./actions"

const key = (
  code: string,
  mods: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }> = {},
) => keyToAction({ code, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods })

test("键盘映射", () => {
  expect(key("Digit7")).toEqual({ type: "digit", digit: 7, note: false })
  expect(key("Numpad3", { shiftKey: true })).toEqual({ type: "digit", digit: 3, note: true })
  expect(key("Digit3", { altKey: true })).toEqual({ type: "digit", digit: 3, note: true })
  expect(key("Digit0")).toEqual({ type: "clear" })
  expect(key("Backspace")).toEqual({ type: "clear" })
  expect(key("ArrowLeft")).toEqual({ type: "move", dr: 0, dc: -1 })
  expect(key("KeyZ", { metaKey: true })).toEqual({ type: "undo" })
  expect(key("KeyZ", { ctrlKey: true, shiftKey: true })).toEqual({ type: "redo" })
  expect(key("KeyY", { ctrlKey: true })).toEqual({ type: "redo" })
  expect(key("KeyN")).toEqual({ type: "toggleNotes" })
  expect(key("Digit7", { ctrlKey: true })).toBeNull()
  expect(key("KeyQ")).toBeNull()
})
