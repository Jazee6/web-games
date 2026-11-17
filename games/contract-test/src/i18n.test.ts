import { expect, test } from "bun:test"
import { translate } from "./i18n"

test("按 Locale 取文案，未知语言退回英文", () => {
  expect(translate("en")("reset")).toBe("Reset")
  expect(translate("en-GB")("reset")).toBe("Reset")
  expect(translate("xx")("reset")).toBe("Reset")
})
