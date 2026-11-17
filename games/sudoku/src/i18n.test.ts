import { expect, test } from "bun:test"
import { formatTime, translate } from "./i18n"

test("按 Locale 取文案，未知语言退回英文，参数插值", () => {
  expect(translate("en")("undo")).toBe("Undo")
  expect(translate("xx-YY")("undo")).toBe("Undo")
  expect(translate("en")("cell", { row: 3, col: 7 })).toBe("Row 3, column 7")
})

test("用时格式", () => {
  expect(formatTime(0)).toBe("0:00")
  expect(formatTime(65_999)).toBe("1:05")
  expect(formatTime(3_725_000)).toBe("1:02:05")
})
