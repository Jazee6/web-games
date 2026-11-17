import { connect, type GameSession } from "@web-games/game-contract/game"
import { translate } from "./i18n"

const session = await connect()
const t = translate(session.locale)

// 模拟资源加载，验证 Player 的加载进度显示。
for (let i = 1; i <= 10; i++) {
  await new Promise((r) => setTimeout(r, 80))
  session.setProgress(i / 10)
}

let count = (await session.save.get<number>("count")) ?? 0
let elapsed = 0
const log: string[] = []

const app = document.querySelector<HTMLElement>("#app")!
app.innerHTML = `
  <dl>
    <dt>${t("contract")}</dt><dd data-field="contract"></dd>
    <dt>${t("locale")}</dt><dd data-field="locale"></dd>
    <dt>${t("timer")}</dt><dd data-field="timer"></dd>
    <dt>${t("muted")}</dt><dd data-field="muted"></dd>
    <dt>${t("fullscreen")}</dt><dd data-field="fullscreen"></dd>
    <dt>${t("save")}</dt><dd data-field="count"></dd>
  </dl>
  <div class="actions">
    <button data-action="increment">${t("increment")}</button>
    <button data-action="reset">${t("reset")}</button>
    <button data-action="mute">${t("toggleMute")}</button>
    <button data-action="fullscreen">${t("toggleFullscreen")}</button>
    <button data-action="interstitial">${t("interstitial")}</button>
    <button data-action="rewarded">${t("rewarded")}</button>
  </div>
  <ol data-field="log"></ol>
`

const field = (name: string) => app.querySelector<HTMLElement>(`[data-field="${name}"]`)!

function render(s: GameSession) {
  field("contract").textContent = s.embedded ? `v${s.contractVersion}` : t("standalone")
  field("locale").textContent = s.locale
  field("timer").textContent = `${elapsed}s${s.paused ? ` (${t("paused")})` : ""}`
  field("muted").textContent = s.muted ? t("yes") : t("no")
  field("fullscreen").textContent = s.fullscreen.available
    ? s.fullscreen.active
      ? t("yes")
      : t("no")
    : t("unavailable")
  field("count").textContent = String(count)
  field("log").innerHTML = log.map((line) => `<li>${line}</li>`).join("")
}

function note(line: string) {
  log.unshift(line)
  log.length = Math.min(log.length, 5)
  render(session)
}

// 计时器只在未暂停时走，用来验证暂停 / 恢复。
setInterval(() => {
  if (session.paused) return
  elapsed++
  render(session)
}, 1000)

for (const event of ["pause", "resume", "mute", "fullscreen"] as const) {
  session.on(event, () => note(t(`event.${event}`)))
}

app.addEventListener("click", async (event) => {
  const action = (event.target as HTMLElement).closest("button")?.dataset.action
  switch (action) {
    case "increment":
      count++
      await session.save.set("count", count)
      session.track("increment", { count })
      note(t("saved"))
      break
    case "reset":
      count = 0
      await session.save.remove("count")
      note(t("cleared"))
      break
    case "mute":
      session.setMuted(!session.muted)
      break
    case "fullscreen":
      session.setFullscreen(!session.fullscreen.active)
      break
    case "interstitial":
    case "rewarded": {
      const result = await session.requestAd(action)
      // Game 必须能处理“广告未展示”，流程照常继续。
      note(result.shown ? t("adShown") : t("adNotShown"))
      if (action === "rewarded" && result.rewarded) {
        count += 10
        await session.save.set("count", count)
      }
      break
    }
  }
})

render(session)
session.ready()
session.track("start")
