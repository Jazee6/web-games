/**
 * 新局选择：Easy / Medium / Hard / Daily Puzzle。打开时焦点落在当前难度上，Escape 关闭并把焦点还回去。
 */
import { For, Show, onCleanup, onMount } from "solid-js"
import { DIFFICULTIES, type Difficulty } from "../core/puzzle"
import type { NewGame } from "../controller"
import type { DailyRecord, Stats } from "../platform/save"
import { formatTime, type Translate } from "../i18n"
import { CheckIcon } from "./icons"

interface Props {
  t: Translate
  current: Difficulty
  dailyDifficulty: Difficulty
  dailyRecord: DailyRecord | undefined
  stats: Stats | null
  onPick(kind: NewGame): void
  onClose(): void
}

export function NewGameDialog(props: Props) {
  let dialog: HTMLDivElement | undefined
  const previous = document.activeElement as HTMLElement | null

  onMount(() => {
    dialog?.querySelector<HTMLButtonElement>("[data-current]")?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault()
        props.onClose()
      }
    }
    document.addEventListener("keydown", onKey, { capture: true })
    onCleanup(() => {
      document.removeEventListener("keydown", onKey, { capture: true })
      previous?.focus()
    })
  })

  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <div ref={(e) => (dialog = e)} class="dialog" role="dialog" aria-modal="true" aria-labelledby="new-game-title">
        <h2 id="new-game-title">{props.t("newGameTitle")}</h2>
        <div class="options">
          <For each={DIFFICULTIES}>
            {(d) => (
              <button
                type="button"
                class="option"
                data-current={d === props.current ? "" : undefined}
                onClick={() => props.onPick(d)}
              >
                <span>{props.t(`difficulty.${d}`)}</span>
                <Show when={props.stats?.[d].bestMs ?? null}>
                  {(ms) => <span class="option-detail">{props.t("best", { time: formatTime(ms()) })}</span>}
                </Show>
              </button>
            )}
          </For>
          <button type="button" class="option option-daily" onClick={() => props.onPick("daily")}>
            <span>{props.t("daily")}</span>
            <span class="option-detail">
              <Show
                when={props.dailyRecord}
                fallback={props.t("dailyToday", { difficulty: props.t(`difficulty.${props.dailyDifficulty}`) })}
              >
                {(record) => (
                  <>
                    <CheckIcon />
                    {props.t("dailySolved", { time: formatTime(record().ms) })}
                  </>
                )}
              </Show>
            </span>
          </button>
        </div>
        <button type="button" class="close" onClick={() => props.onClose()}>
          {props.t("close")}
        </button>
      </div>
    </div>
  )
}
