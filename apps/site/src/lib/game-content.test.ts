import { describe, expect, test } from "bun:test"
import { markdownToText, parseGameContent } from "./game-content"

const valid = `Sudoku is a logic puzzle.

## How to Play

Fill the grid.

## Controls

- Touch: tap a cell.
- Keyboard: arrow keys.

## Tips

Start with rows.

## FAQ

### Is it free?

Yes.

### Does it need an account?

No, progress is saved in your browser.

## Changelog

- 2026-11-16: Launch.
`

describe("parseGameContent", () => {
  test("解析合法内容", () => {
    const { doc, errors } = parseGameContent(valid, "en")
    expect(errors).toEqual([])
    expect(doc!.definition).toBe("Sudoku is a logic puzzle.")
    expect(doc!.sections.tips).toBe("Start with rows.")
    expect(doc!.faq).toEqual([
      { question: "Is it free?", answer: "Yes." },
      { question: "Does it need an account?", answer: "No, progress is saved in your browser." },
    ])
  })

  test("Changelog 可选", () => {
    const { errors } = parseGameContent(valid.slice(0, valid.indexOf("## Changelog")), "en")
    expect(errors).toEqual([])
  })

  test("缺少必填章节", () => {
    const { errors } = parseGameContent(valid.replace("## Tips\n\nStart with rows.\n", ""), "en")
    expect(errors).toContain('缺少必填章节 "## Tips"')
  })

  test("缺少定义或定义多于一段", () => {
    expect(parseGameContent(valid.replace("Sudoku is a logic puzzle.", ""), "en").errors).toContain(
      "缺少一段话定义（第一个 H2 之前）",
    )
    expect(parseGameContent("One.\n\nTwo.\n" + valid.slice(valid.indexOf("##")), "en").errors).toContain(
      "一段话定义只能有一段",
    )
  })

  test("章节顺序、未知章节、空章节", () => {
    const swapped = valid.replace("## How to Play\n\nFill the grid.\n\n", "") + "\n## How to Play\n\nFill.\n"
    expect(parseGameContent(swapped, "en").errors.some((e) => e.startsWith("章节顺序"))).toBe(true)
    expect(parseGameContent(valid + "\n## Extra\n\nx\n", "en").errors.some((e) => e.startsWith("未知章节"))).toBe(true)
    expect(parseGameContent(valid.replace("Start with rows.", ""), "en").errors).toContain('章节 "## Tips" 是空的')
  })

  test("FAQ 问题必须是问句且有回答", () => {
    const errors = parseGameContent(valid.replace("### Is it free?\n\nYes.", "### Free\n\n### Price?\n"), "en").errors
    expect(errors).toContain("FAQ 问题要写成完整问句：Free")
    expect(errors).toContain("FAQ 问题没有回答：Free")
  })

  test("代码块里的 # 不算标题", () => {
    const withCode = valid.replace("Start with rows.", "Start with rows.\n\n```\n## Not a heading\n```")
    expect(parseGameContent(withCode, "en").errors).toEqual([])
  })

  test("不支持的 Locale", () => {
    expect(parseGameContent(valid, "xx").errors).toEqual(['没有 Locale "xx" 的章节标题'])
  })
})

test("markdownToText", () => {
  expect(markdownToText("Use **arrow keys** or [tap](/x).\n- one\n- two")).toBe("Use arrow keys or tap. one two")
})
