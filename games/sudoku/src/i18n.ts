/**
 * 游戏内文案。按 session.locale 取表，缺失时退回英文。内核只产出 key，这里负责翻译。
 * 参数写作 {name}。
 */
const messages = {
  en: {
    title: "Sudoku",
    loading: "Generating puzzle…",
    "difficulty.easy": "Easy",
    "difficulty.medium": "Medium",
    "difficulty.hard": "Hard",
    daily: "Daily",
    dailyOf: "Daily · {date}",
    newGame: "New game",
    newGameTitle: "Start a new game",
    close: "Close",
    dailySolved: "Solved in {time}",
    best: "Best {time}",
    dailyToday: "Today's puzzle · {difficulty}",
    timer: "Time",
    board: "Sudoku board",
    cell: "Row {row}, column {col}",
    cellEmpty: "empty",
    cellGiven: "given {digit}",
    cellValue: "{digit}",
    cellNotes: "notes {digits}",
    cellConflict: "conflict",
    digit: "Enter {digit}",
    digitRemaining: "{digit}, {count} left",
    digitDone: "{digit}, all placed",
    undo: "Undo",
    redo: "Redo",
    erase: "Erase",
    notes: "Notes",
    hint: "Hint",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    solved: "Solved!",
    solvedTime: "Time {time}",
    solvedHints: "Hints used: {count}",
    playAgain: "New game",
    "hint.mistake": "This cell is wrong.",
    "hint.reveal": "Revealed one cell.",
    "hint.technique": "Found with: {technique}.",
    "technique.hiddenSingle": "Hidden single",
    "technique.nakedSingle": "Naked single",
    "technique.pointing": "Pointing",
    "technique.boxLine": "Box/line reduction",
    "technique.nakedPair": "Naked pair",
    "technique.hiddenPair": "Hidden pair",
    "technique.nakedTriple": "Naked triple",
    "technique.hiddenTriple": "Hidden triple",
    "technique.xWing": "X-Wing",
    "technique.yWing": "Y-Wing",
  },
} as const

export type MessageKey = keyof (typeof messages)["en"]
export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string

/** 按传入的 Locale 取文案，没有对应语言或缺 key 时退回英文。 */
export function translate(locale: string): Translate {
  const language = locale.split("-")[0] as keyof typeof messages
  const table: Partial<Record<MessageKey, string>> = messages[language] ?? messages.en
  return (key, params) => {
    const text: string = table[key] ?? messages.en[key]
    return params ? text.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match)) : text
  }
}

/** 用时显示：m:ss 或 h:mm:ss。 */
export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, "0")
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`
}
