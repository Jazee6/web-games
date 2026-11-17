/**
 * 组装 Kernel、计时、Save 与生成器：动作 → 命令（附加 ms）→ kernel.apply → Solid store。
 * 权威状态在这里的 Kernel 状态里；store 只是给视图读的投影。
 */
import type { GameSession } from "@web-games/game-contract/game"
import { createStore, reconcile } from "solid-js/store"
import type { Command } from "./core/commands"
import { dailySetup } from "./core/daily"
import { LATEST_GENERATOR } from "./core/generators"
import { kernel, type HintResult, type State } from "./core/kernel"
import type { Difficulty } from "./core/puzzle"
import { canReplay, replay, type Replay } from "./core/replay"
import { createClock } from "./platform/clock"
import { createGenerator } from "./platform/generator"
import { createSaveWriter, readSave, type DailyLog, type Stats } from "./platform/save"

/** 视图读取的盘面投影。 */
export interface BoardView {
  difficulty: Difficulty
  givens: number[]
  values: number[]
  notes: number[]
  hint: HintResult | null
  hints: number
  solvedMs: number | null
  canUndo: boolean
  canRedo: boolean
}

export interface GameStore {
  status: "loading" | "playing"
  board: BoardView | null
  /** Daily Puzzle 的日期；随机开局为 null。 */
  daily: string | null
  difficulty: Difficulty
  dailyLog: DailyLog
  stats: Stats | null
}

export type NewGame = Difficulty | "daily"

type CommandInput = Command extends infer C ? (C extends Command ? Omit<C, "ms"> : never) : never

export function createController(session: GameSession, today: () => string) {
  const clock = createClock()
  const generator = createGenerator()
  const writer = createSaveWriter(session)

  const [store, setStore] = createStore<GameStore>({
    status: "loading",
    board: null,
    daily: null,
    difficulty: "easy",
    dailyLog: {},
    stats: null,
  })

  let state: State | null = null
  let current: Replay | null = null
  let stats: Stats
  let dailyLog: DailyLog
  /** 最新一次开局请求，丢弃过期的生成结果。 */
  let token = 0

  const isPaused = () => session.paused || document.hidden

  function project(s: State): BoardView {
    return {
      difficulty: s.difficulty,
      givens: s.givens.slice(),
      values: s.values.slice(),
      notes: s.notes.slice(),
      hint: s.hint,
      hints: s.hints,
      solvedMs: s.solvedMs,
      canUndo: s.past.length > 0,
      canRedo: s.future.length > 0,
    }
  }

  function show(s: State) {
    setStore("board", reconcile(project(s)))
  }

  function startClock() {
    if (state && state.solvedMs === null && !isPaused()) clock.start()
  }

  /** 写 current：Replay 加上此刻的有效用时。 */
  function saveCurrent() {
    if (current) writer.schedule("current", { replay: current, elapsedMs: clock.elapsed() })
  }

  // 计时运行时每 2 秒记一次用时。在 Player 里刷新页面时，父页面与 iframe 一起卸载，
  // 卸载时发出的 Save 消息可能到不了 Player，所以不能只靠 pagehide；最多丢失约 2 秒。
  setInterval(() => clock.running && saveCurrent(), 2000)
  addEventListener("pagehide", () => {
    saveCurrent()
    writer.flush()
  })

  async function begin(r: Replay, restoring: boolean, elapsedMs = 0): Promise<boolean> {
    const mine = ++token
    setStore("status", "loading")
    clock.stop()
    const puzzle = await generator.generate({ seed: r.seed, generatorVersion: r.generatorVersion, options: r.options })
    if (mine !== token) return false
    const next = restoring ? replay(r, puzzle) : kernel.start(puzzle)
    if (!next) return false
    state = next
    current = r
    clock.reset(next.solvedMs ?? Math.max(next.ms, elapsedMs))
    setStore({ status: "playing", daily: r.options.daily ?? null, difficulty: r.options.difficulty })
    show(next)
    startClock()
    return true
  }

  async function newGame(kind: NewGame) {
    const date = today()
    const setup =
      kind === "daily"
        ? (() => {
            const d = dailySetup(date)
            return {
              seed: d.seed,
              generatorVersion: d.generatorVersion,
              options: { difficulty: d.difficulty, daily: date },
            }
          })()
        : { seed: randomSeed(), generatorVersion: LATEST_GENERATOR, options: { difficulty: kind } }
    const r: Replay = { kernelVersion: kernel.version, ...setup, commands: [] }
    if (!(await begin(r, false))) return
    const difficulty = r.options.difficulty
    stats = { ...stats, [difficulty]: { ...stats[difficulty], started: stats[difficulty].started + 1 } }
    setStore("stats", reconcile(stats))
    if (kind !== "daily") writer.schedule("settings", { difficulty: kind })
    writer.schedule("stats", stats)
    saveCurrent()
    session.track("start", { difficulty, daily: kind === "daily" })
  }

  /** 读取 Save：能重演的进行中一局就恢复，否则按上次的难度开新局。 */
  async function load(onProgress: (value: number) => void) {
    const [settings, saved, log, savedStats] = await Promise.all([
      readSave(session, "settings"),
      readSave(session, "current"),
      readSave(session, "daily"),
      readSave(session, "stats"),
    ])
    stats = savedStats
    dailyLog = log
    setStore({ difficulty: settings.difficulty, dailyLog: log, stats })
    onProgress(0.5)
    if (saved && canReplay(saved.replay) && (await begin(saved.replay, true, saved.elapsedMs))) return
    // 内核版本不一致或数据损坏：丢弃这一局，开新局。
    await newGame(settings.difficulty)
  }

  function dispatch(input: CommandInput) {
    if (!state || !current || store.status !== "playing") return
    const command = { ...input, ms: clock.elapsed() } as Command
    const next = kernel.apply(state, command)
    if (next === state) return
    const wasSolved = state.solvedMs !== null
    state = next
    current = { ...current, commands: [...current.commands, command] }
    show(next)
    saveCurrent()
    if (!wasSolved && next.solvedMs !== null) complete(next)
  }

  function complete(s: State) {
    clock.stop()
    const ms = s.solvedMs!
    const difficulty = s.difficulty
    const prev = stats[difficulty]
    const bestMs = s.hints === 0 && (prev.bestMs === null || ms < prev.bestMs) ? ms : prev.bestMs
    stats = { ...stats, [difficulty]: { ...prev, solved: prev.solved + 1, bestMs } }
    setStore("stats", reconcile(stats))
    writer.schedule("stats", stats)
    const date = current?.options.daily
    if (date && !dailyLog[date]) {
      dailyLog = { ...dailyLog, [date]: { ms, hints: s.hints } }
      setStore("dailyLog", reconcile(dailyLog))
      writer.schedule("daily", dailyLog)
    }
    writer.flush()
    session.track("complete", { difficulty, ms, hints: s.hints, daily: Boolean(date) })
  }

  function pause() {
    clock.stop()
    saveCurrent()
    writer.flush()
  }

  return {
    store,
    load,
    newGame,
    dispatch,
    pause,
    resume: startClock,
    elapsed: () => clock.elapsed(),
    isPaused,
  }
}

export type Controller = ReturnType<typeof createController>

/** 随机开局的种子由外层生成（可以用 crypto），再交给内核。 */
function randomSeed() {
  const bytes = crypto.getRandomValues(new Uint32Array(2))
  return Array.from(bytes, (n) => n.toString(16).padStart(8, "0")).join("")
}
