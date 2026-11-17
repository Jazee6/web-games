/**
 * 入口：connect → 加载 Save → 生成或恢复题目 → ready。
 */
import { connect } from "@web-games/game-contract/game"
import { render } from "solid-js/web"
import { createController } from "./controller"
import { translate } from "./i18n"
import { App } from "./view/App"

const session = await connect()
session.setProgress(0.1)

const t = translate(session.locale)
document.documentElement.lang = session.locale
document.title = t("title")

/** 今天的 UTC 日期。内核不读时钟，由这里传入。 */
const today = () => new Date().toISOString().slice(0, 10)

const controller = createController(session, today)
let syncClock = () => {}

render(
  () => (
    <App controller={controller} t={t} locale={session.locale} today={today} onClockSync={(s) => (syncClock = s)} />
  ),
  document.querySelector("#app")!,
)

// 暂停：停止计时并立即写一次 Save；恢复：继续计时。
// 独立运行时（直接打开 /play/sudoku/）没有 Player 的 pause 通知，自己监听页面可见性。
function onPauseChange() {
  if (controller.isPaused()) controller.pause()
  else controller.resume()
  syncClock()
}
session.on("pause", onPauseChange)
session.on("resume", onPauseChange)
document.addEventListener("visibilitychange", onPauseChange)

await controller.load((value) => session.setProgress(0.1 + value * 0.8))
syncClock()
session.setProgress(1)
session.ready()
