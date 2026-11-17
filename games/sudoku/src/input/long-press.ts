/**
 * 长按（触屏上对应“草稿”）：按住超过 delay 触发 onLongPress，随后的 click 被吞掉。
 * 用 Pointer Events，不分别处理 mouse 与 touch。
 */
export function longPress(el: HTMLElement, onLongPress: () => void, delay = 450) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let fired = false
  const cancel = () => clearTimeout(timer)
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return
    fired = false
    cancel()
    timer = setTimeout(() => {
      fired = true
      onLongPress()
    }, delay)
  })
  el.addEventListener("pointerup", cancel)
  el.addEventListener("pointerleave", cancel)
  el.addEventListener("pointercancel", cancel)
  // 长按不弹出系统菜单（iOS 另有 -webkit-touch-callout: none）。
  el.addEventListener("contextmenu", (e) => e.preventDefault())
  el.addEventListener(
    "click",
    (e) => {
      if (!fired) return
      fired = false
      e.stopImmediatePropagation()
      e.preventDefault()
    },
    { capture: true },
  )
}
