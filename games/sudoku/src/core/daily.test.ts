import { expect, test } from "bun:test"
import { dailyDifficulty, dailyGeneratorVersion, dailySeed, daysFromCivil, isUtcDate, weekday } from "./daily"

test("UTC 日期校验", () => {
  expect(isUtcDate("2026-11-17")).toBe(true)
  expect(isUtcDate("2028-02-29")).toBe(true)
  expect(isUtcDate("2027-02-29")).toBe(false)
  expect(isUtcDate("2026-13-01")).toBe(false)
  expect(isUtcDate("2026-1-1")).toBe(false)
})

test("星期与日期换算", () => {
  expect(daysFromCivil("1970-01-01")).toBe(0)
  expect(daysFromCivil("2000-03-01")).toBe(11017)
  expect(weekday("1970-01-01")).toBe(4)
  expect(weekday("2026-11-17")).toBe(2) // 星期二
  expect(weekday("1969-12-31")).toBe(3)
})

test("难度按星期轮换", () => {
  expect(dailyDifficulty("2026-11-16")).toBe("easy") // 一
  expect(dailyDifficulty("2026-11-17")).toBe("easy") // 二
  expect(dailyDifficulty("2026-11-18")).toBe("medium") // 三
  expect(dailyDifficulty("2026-11-20")).toBe("medium") // 五
  expect(dailyDifficulty("2026-11-21")).toBe("hard") // 六
  expect(dailyDifficulty("2026-11-22")).toBe("hard") // 日
})

test("早于首发日期的日期沿用 v1；种子只由日期与版本决定", () => {
  expect(dailyGeneratorVersion("2020-01-01")).toBe(1)
  expect(dailyGeneratorVersion("2026-11-17")).toBe(1)
  expect(dailySeed("2026-11-17")).toBe(dailySeed("2026-11-17"))
  expect(dailySeed("2026-11-17")).not.toBe(dailySeed("2026-11-18"))
  expect(dailySeed("2026-11-17", 1)).not.toBe(dailySeed("2026-11-17", 2))
})
