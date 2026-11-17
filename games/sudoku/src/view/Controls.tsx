/**
 * 工具栏（用时、撤销、重做、清除、草稿、提示、新局）与数字面板。
 * 触屏：点数字 = 填数，长按数字 = 草稿；草稿模式下点数字 = 草稿。
 * 窄竖屏时数字面板改为 5 × 2，清除键移到面板第 10 格（工具栏里的清除键由 CSS 隐藏）。
 */
import { For, Show, createMemo, onMount, type Accessor, type JSX } from "solid-js"
import type { BoardView } from "../controller"
import { formatTime, type Translate } from "../i18n"
import { longPress } from "../input/long-press"
import { EraseIcon, HintIcon, NewGameIcon, NotesIcon, RedoIcon, UndoIcon, ZoomInIcon, ZoomOutIcon } from "./icons"

interface ToolbarProps {
  board: BoardView
  modeLabel: string
  elapsed: Accessor<number>
  notesMode: Accessor<boolean>
  /** 格子小于 44 px 时才显示缩放键。 */
  zoomable: Accessor<boolean>
  zoomed: Accessor<boolean>
  t: Translate
  onUndo(): void
  onRedo(): void
  onErase(): void
  onToggleNotes(): void
  onHint(): void
  onToggleZoom(): void
  onNewGame(): void
}

export function Toolbar(props: ToolbarProps) {
  const solved = () => props.board.solvedMs !== null
  return (
    <div class="toolbar">
      <div class="status">
        <span class="mode">{props.modeLabel}</span>
        <span class="time" role="timer" aria-label={props.t("timer")}>
          {formatTime(props.board.solvedMs ?? props.elapsed())}
        </span>
      </div>
      <div class="tools">
        <IconButton label={props.t("undo")} disabled={solved() || !props.board.canUndo} onClick={props.onUndo}>
          <UndoIcon />
        </IconButton>
        <IconButton label={props.t("redo")} disabled={solved() || !props.board.canRedo} onClick={props.onRedo}>
          <RedoIcon />
        </IconButton>
        <IconButton class="tool-erase" label={props.t("erase")} disabled={solved()} onClick={props.onErase}>
          <EraseIcon />
        </IconButton>
        <IconButton
          label={props.t("notes")}
          disabled={solved()}
          pressed={props.notesMode()}
          onClick={props.onToggleNotes}
        >
          <NotesIcon />
        </IconButton>
        <IconButton label={props.t("hint")} disabled={solved()} onClick={props.onHint}>
          <HintIcon />
        </IconButton>
        <Show when={props.zoomable()}>
          <IconButton label={props.zoomed() ? props.t("zoomOut") : props.t("zoomIn")} onClick={props.onToggleZoom}>
            <Show when={props.zoomed()} fallback={<ZoomInIcon />}>
              <ZoomOutIcon />
            </Show>
          </IconButton>
        </Show>
        <IconButton label={props.t("newGame")} onClick={props.onNewGame}>
          <NewGameIcon />
        </IconButton>
      </div>
    </div>
  )
}

function IconButton(props: {
  class?: string
  label: string
  disabled?: boolean
  pressed?: boolean
  onClick(): void
  children: JSX.Element
}) {
  return (
    <button
      type="button"
      class={props.class ? `icon-button ${props.class}` : "icon-button"}
      aria-label={props.label}
      title={props.label}
      aria-pressed={props.pressed === undefined ? undefined : props.pressed}
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  )
}

interface PadProps {
  board: BoardView
  notesMode: Accessor<boolean>
  t: Translate
  onDigit(digit: number, note: boolean): void
  onErase(): void
}

export function NumberPad(props: PadProps) {
  const counts = createMemo(() => {
    const n = Array.from({ length: 10 }, () => 0)
    for (const v of props.board.values) n[v]!++
    return n
  })
  return (
    <div class="pad" data-notes={props.notesMode() ? "" : undefined}>
      <For each={[1, 2, 3, 4, 5, 6, 7, 8, 9]}>
        {(digit) => {
          let el: HTMLButtonElement | undefined
          onMount(() => el && longPress(el, () => props.onDigit(digit, true)))
          const remaining = () => 9 - counts()[digit]!
          return (
            <button
              ref={(e) => (el = e)}
              type="button"
              class="digit"
              classList={{ done: remaining() <= 0 }}
              aria-label={
                remaining() <= 0
                  ? props.t("digitDone", { digit })
                  : props.t("digitRemaining", { digit, count: remaining() })
              }
              onClick={() => props.onDigit(digit, props.notesMode())}
            >
              <span class="digit-value">{digit}</span>
              <Show when={remaining() > 0}>
                <span class="digit-count" aria-hidden="true">
                  {remaining()}
                </span>
              </Show>
            </button>
          )
        }}
      </For>
      <button type="button" class="digit pad-erase" aria-label={props.t("erase")} onClick={() => props.onErase()}>
        <EraseIcon />
      </button>
    </div>
  )
}
