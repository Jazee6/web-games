/**
 * 页面组装：工具栏、网格、数字面板、新局对话框。键盘在 document 上统一处理（input/actions.ts）。
 */
import { Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js"
import type { Controller, NewGame } from "../controller"
import { dailyDifficulty } from "../core/daily"
import { colOf, rowOf } from "../core/grid"
import { formatTime, type Translate } from "../i18n"
import { keyToAction, type Action } from "../input/actions"
import { Board } from "./Board"
import { NumberPad, Toolbar } from "./Controls"
import { NewGameDialog } from "./NewGameDialog"

/** 9 格 × 44 px + 网格外框 2 × 2 px：网格比这窄时格子不到 44 px。 */
const ZOOM_BELOW = 9 * 44 + 4

interface Props {
  controller: Controller
  t: Translate
  locale: string
  today: () => string
  /** 由 main 注册：暂停 / 恢复时同步计时显示。 */
  onClockSync(sync: () => void): void
}

export function App(props: Props) {
  const { controller, t } = props
  const store = controller.store
  const [selected, setSelected] = createSignal(40)
  const [notesMode, setNotesMode] = createSignal(false)
  const [dialogOpen, setDialogOpen] = createSignal(false)
  const [elapsed, setElapsed] = createSignal(0)
  const cellRefs: HTMLButtonElement[] = []

  // 缩放：网格边长不到 9 × 44 px（加边框）时出现缩放键；放大后格子为 44 px，网格在视窗里原生滚动平移。
  const [zoomable, setZoomable] = createSignal(false)
  const [zoomRequested, setZoomRequested] = createSignal(false)
  const zoomed = () => zoomable() && zoomRequested()
  let viewport: HTMLDivElement | undefined

  function observeBoardArea(el: HTMLDivElement) {
    const observer = new ResizeObserver(([entry]) => setZoomable(entry!.contentRect.width < ZOOM_BELOW))
    observer.observe(el)
    onCleanup(() => observer.disconnect())
  }

  /** 让格子在视窗内可见：center 为真时居中，否则只滚动最小距离。 */
  function reveal(cell: number, center: boolean) {
    const el = cellRefs[cell]
    if (!viewport || !el) return
    const fit = (start: number, size: number, scroll: number, view: number) =>
      center ? start + size / 2 - view / 2 : Math.min(start, Math.max(scroll, start + size - view))
    viewport.scrollTo(
      fit(el.offsetLeft, el.offsetWidth, viewport.scrollLeft, viewport.clientWidth),
      fit(el.offsetTop, el.offsetHeight, viewport.scrollTop, viewport.clientHeight),
    )
  }

  createEffect(on(zoomed, (z) => z && reveal(selected(), true)))
  createEffect(on(selected, (cell) => zoomed() && reveal(cell, false)))

  // 计时显示：requestAnimationFrame，只在可见且未暂停时刷新；按秒取整，文字每秒才更新一次。
  let raf = 0
  const tick = () => {
    setElapsed(Math.floor(controller.elapsed() / 1000) * 1000)
    raf = requestAnimationFrame(tick)
  }
  const syncClock = () => {
    cancelAnimationFrame(raf)
    setElapsed(Math.floor(controller.elapsed() / 1000) * 1000)
    if (!controller.isPaused()) raf = requestAnimationFrame(tick)
  }
  props.onClockSync(syncClock)
  syncClock()
  onCleanup(() => cancelAnimationFrame(raf))

  // 提示后把选中格移到提示的格子上。
  createEffect(
    on(
      () => store.board?.hint,
      (hint) => hint && setSelected(hint.cell),
    ),
  )

  function move(dr: number, dc: number) {
    const cell = selected()
    const r = Math.min(8, Math.max(0, rowOf(cell) + dr))
    const c = Math.min(8, Math.max(0, colOf(cell) + dc))
    const next = r * 9 + c
    const focusInGrid = cellRefs.includes(document.activeElement as HTMLButtonElement)
    setSelected(next)
    if (focusInGrid) cellRefs[next]?.focus()
  }

  function digit(d: number, note: boolean) {
    controller.dispatch({ t: note ? "note" : "place", cell: selected(), digit: d })
  }

  function perform(action: Action) {
    switch (action.type) {
      case "move":
        return move(action.dr, action.dc)
      case "digit":
        return digit(action.digit, action.note || notesMode())
      case "clear":
        return controller.dispatch({ t: "clear", cell: selected() })
      case "undo":
        return controller.dispatch({ t: "undo" })
      case "redo":
        return controller.dispatch({ t: "redo" })
      case "toggleNotes":
        return setNotesMode(!notesMode())
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (dialogOpen() || e.defaultPrevented) return
    const action = keyToAction(e)
    if (!action) return
    e.preventDefault()
    perform(action)
  }
  document.addEventListener("keydown", onKeyDown)
  onCleanup(() => document.removeEventListener("keydown", onKeyDown))

  function pick(kind: NewGame) {
    setDialogOpen(false)
    setNotesMode(false)
    setSelected(40)
    void controller.newGame(kind).then(syncClock)
  }

  const modeLabel = createMemo(() => {
    if (store.daily) {
      const date = new Date(`${store.daily}T00:00:00Z`).toLocaleDateString(props.locale, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
      return t("dailyOf", { date })
    }
    return t(`difficulty.${store.difficulty}`)
  })

  const hintMessage = createMemo(() => {
    const hint = store.board?.hint
    if (!hint || store.board?.solvedMs !== null) return ""
    if (hint.kind === "mistake") return t("hint.mistake")
    return hint.technique ? t("hint.technique", { technique: t(`technique.${hint.technique}`) }) : t("hint.reveal")
  })

  return (
    <div class="game" data-loading={store.status === "loading" ? "" : undefined}>
      <Show
        when={store.board}
        fallback={
          <div class="loading" role="status">
            <span class="spinner" aria-hidden="true" />
            {t("loading")}
          </div>
        }
      >
        {(board) => (
          <>
            <Toolbar
              board={board()}
              modeLabel={modeLabel()}
              elapsed={elapsed}
              notesMode={notesMode}
              t={t}
              onUndo={() => perform({ type: "undo" })}
              onRedo={() => perform({ type: "redo" })}
              onErase={() => perform({ type: "clear" })}
              onToggleNotes={() => perform({ type: "toggleNotes" })}
              onHint={() => controller.dispatch({ t: "hint" })}
              zoomable={zoomable}
              zoomed={zoomed}
              onToggleZoom={() => setZoomRequested(!zoomed())}
              onNewGame={() => setDialogOpen(true)}
            />
            <div class="board-area" ref={observeBoardArea} data-zoomed={zoomed() ? "" : undefined}>
              <div class="board-viewport" ref={(el) => (viewport = el)}>
                <Board board={board()} selected={selected} onSelect={setSelected} cellRefs={cellRefs} t={t} />
              </div>
              <p class="message" role="status" aria-live="polite">
                <Show when={hintMessage()}>
                  <span>{hintMessage()}</span>
                </Show>
              </p>
              <Show when={store.status === "loading"}>
                <div class="board-loading" role="status">
                  <span class="spinner" aria-hidden="true" />
                  <span class="sr-only">{t("loading")}</span>
                </div>
              </Show>
            </div>
            <Show
              when={board().solvedMs === null}
              fallback={
                <div class="solved" role="status">
                  <strong>{t("solved")}</strong>
                  <span>{t("solvedTime", { time: formatTime(board().solvedMs!) })}</span>
                  <Show when={board().hints > 0}>
                    <span>{t("solvedHints", { count: board().hints })}</span>
                  </Show>
                  <button type="button" class="primary" onClick={() => setDialogOpen(true)}>
                    {t("playAgain")}
                  </button>
                </div>
              }
            >
              <NumberPad
                board={board()}
                notesMode={notesMode}
                t={t}
                onDigit={digit}
                onErase={() => perform({ type: "clear" })}
              />
            </Show>
          </>
        )}
      </Show>
      <Show when={dialogOpen()}>
        <NewGameDialog
          t={t}
          current={store.difficulty}
          dailyDifficulty={dailyDifficulty(props.today())}
          dailyRecord={store.dailyLog[props.today()]}
          stats={store.stats}
          onPick={pick}
          onClose={() => setDialogOpen(false)}
        />
      </Show>
    </div>
  )
}
