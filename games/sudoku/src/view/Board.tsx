/**
 * 9 × 9 网格：role="grid" / row / gridcell，roving tabindex。
 * 冲突、同数字、同组高亮是纯展示的派生量，用 createMemo 从 store 计算。
 */
import { For, Show, createMemo, type Accessor } from "solid-js"
import { UNITS, boxOf, colOf, rowOf } from "../core/grid"
import { bit } from "../core/math"
import type { BoardView } from "../controller"
import type { Translate } from "../i18n"

const NINE = [0, 1, 2, 3, 4, 5, 6, 7, 8]

interface Props {
  board: BoardView
  selected: Accessor<number>
  onSelect(cell: number): void
  /** 格子按钮的 ref，用于键盘移动时转移焦点。 */
  cellRefs: HTMLButtonElement[]
  t: Translate
}

export function Board(props: Props) {
  const conflicts = createMemo(() => {
    const values = props.board.values
    const out = new Set<number>()
    for (const unit of UNITS) {
      for (const a of unit) {
        if (!values[a]) continue
        for (const b of unit) if (a !== b && values[a] === values[b]) out.add(a)
      }
    }
    return out
  })

  const selectedDigit = createMemo(() => props.board.values[props.selected()] ?? 0)
  const hintCell = createMemo(() => props.board.hint?.cell ?? -1)

  function isPeer(cell: number) {
    const s = props.selected()
    return cell !== s && (rowOf(cell) === rowOf(s) || colOf(cell) === colOf(s) || boxOf(cell) === boxOf(s))
  }

  function label(cell: number) {
    const t = props.t
    const parts = [t("cell", { row: rowOf(cell) + 1, col: colOf(cell) + 1 })]
    const value = props.board.values[cell]!
    const notes = props.board.notes[cell]!
    if (props.board.givens[cell]) parts.push(t("cellGiven", { digit: value }))
    else if (value) parts.push(t("cellValue", { digit: value }))
    else if (notes)
      parts.push(
        t("cellNotes", {
          digits: NINE.filter((i) => notes & bit(i + 1))
            .map((i) => i + 1)
            .join(" "),
        }),
      )
    else parts.push(t("cellEmpty"))
    if (conflicts().has(cell)) parts.push(t("cellConflict"))
    return parts.join(", ")
  }

  return (
    <div
      class="board"
      role="grid"
      aria-label={props.t("board")}
      aria-rowcount={9}
      aria-colcount={9}
      data-solved={props.board.solvedMs !== null ? "" : undefined}
    >
      <For each={NINE}>
        {(r) => (
          <div role="row" class="board-row" aria-rowindex={r + 1}>
            <For each={NINE}>
              {(c) => {
                const cell = r * 9 + c
                return (
                  <button
                    ref={(el) => (props.cellRefs[cell] = el)}
                    type="button"
                    role="gridcell"
                    class="cell"
                    aria-colindex={c + 1}
                    aria-selected={props.selected() === cell}
                    aria-label={label(cell)}
                    tabindex={props.selected() === cell ? 0 : -1}
                    classList={{
                      "edge-r": c === 2 || c === 5,
                      "edge-b": r === 2 || r === 5,
                      given: Boolean(props.board.givens[cell]),
                      peer: isPeer(cell),
                      same: selectedDigit() !== 0 && props.board.values[cell] === selectedDigit(),
                      conflict: conflicts().has(cell),
                      hinted: hintCell() === cell,
                    }}
                    onClick={() => props.onSelect(cell)}
                  >
                    <Show when={props.board.values[cell]} fallback={<Notes mask={props.board.notes[cell]!} />}>
                      {(value) => <span class="value">{value()}</span>}
                    </Show>
                  </button>
                )
              }}
            </For>
          </div>
        )}
      </For>
    </div>
  )
}

function Notes(props: { mask: number }) {
  return (
    <Show when={props.mask}>
      <span class="notes" aria-hidden="true">
        <For each={NINE}>{(i) => <span>{props.mask & bit(i + 1) ? i + 1 : ""}</span>}</For>
      </span>
    </Show>
  )
}
