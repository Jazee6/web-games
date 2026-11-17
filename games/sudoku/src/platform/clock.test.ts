import { expect, test } from "bun:test"
import { createClock } from "./clock"

test("暂停期间不计时，reset 从已用时间继续", () => {
  let t = 0
  const clock = createClock(() => t)
  clock.reset(1000)
  clock.start()
  t = 500
  expect(clock.elapsed()).toBe(1500)
  clock.stop()
  t = 10_000
  expect(clock.elapsed()).toBe(1500)
  clock.start()
  t = 10_250
  expect(clock.elapsed()).toBe(1750)
})
