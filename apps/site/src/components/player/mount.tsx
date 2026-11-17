import { createRoot } from "react-dom/client"
import { PlayerShell } from "./PlayerShell"

/** 在 Player 容器里挂载 React 外壳，封面保留到 Game 就绪后再移除。 */
export function mountPlayer(root: HTMLElement) {
  const { slug, name, locale } = root.dataset
  const host = document.createElement("div")
  host.className = "flex min-h-0 flex-1 flex-col"
  root.prepend(host)
  root.querySelector("[data-player-start]")?.remove()
  createRoot(host).render(
    <PlayerShell
      root={root}
      slug={slug!}
      name={name!}
      locale={locale!}
      onReady={() => root.querySelector("[data-player-cover]")?.remove()}
    />,
  )
}
