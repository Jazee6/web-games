/**
 * Game Content 模板（design.md 4.1）：解析 Markdown 正文并校验固定章节。
 * 纯函数，不依赖 Astro，可在 bun test 下运行。
 *
 * 正文结构：
 *   <一段话定义>              第一个 H2 之前，必填，恰好一段
 *   ## How to Play           必填
 *   ## Controls              必填，触屏与键鼠分别说明
 *   ## Tips                  必填
 *   ## FAQ                   必填，每个问题一个 H3（完整问句，以 ? 结尾），下面是回答
 *   ## Changelog             可选
 * 相关 Game 由站点生成，不写在正文里。
 */

export type SectionKey = "howToPlay" | "controls" | "tips" | "faq" | "changelog"

interface SectionSpec {
  key: SectionKey
  required: boolean
}

/** 章节按此顺序出现。 */
const SECTIONS: SectionSpec[] = [
  { key: "howToPlay", required: true },
  { key: "controls", required: true },
  { key: "tips", required: true },
  { key: "faq", required: true },
  { key: "changelog", required: false },
]

/** 各 Locale 的章节标题。新增 Locale 时在这里加一份。 */
export const SECTION_TITLES: Record<string, Record<SectionKey, string>> = {
  en: {
    howToPlay: "How to Play",
    controls: "Controls",
    tips: "Tips",
    faq: "FAQ",
    changelog: "Changelog",
  },
}

export interface FaqItem {
  question: string
  /** 回答的 Markdown 原文。 */
  answer: string
}

export interface GameContentDoc {
  /** 一段话定义的 Markdown 原文。 */
  definition: string
  sections: Partial<Record<SectionKey, string>>
  faq: FaqItem[]
}

interface Block {
  heading: string
  body: string
}

/** 按指定级别的标题切分，跳过代码块里的 #。返回标题前的内容和各块。 */
function splitByHeading(markdown: string, level: 2 | 3): { lead: string; blocks: Block[] } {
  const marker = "#".repeat(level) + " "
  const lines = markdown.split("\n")
  const lead: string[] = []
  const blocks: { heading: string; lines: string[] }[] = []
  let fence = false
  for (const line of lines) {
    if (/^(```|~~~)/.test(line.trimStart())) fence = !fence
    if (!fence && line.startsWith(marker)) {
      blocks.push({ heading: line.slice(marker.length).trim(), lines: [] })
      continue
    }
    ;(blocks.at(-1)?.lines ?? lead).push(line)
  }
  return {
    lead: lead.join("\n").trim(),
    blocks: blocks.map((b) => ({ heading: b.heading, body: b.lines.join("\n").trim() })),
  }
}

export function parseGameContent(body: string, locale: string): { doc?: GameContentDoc; errors: string[] } {
  const titles = SECTION_TITLES[locale]
  if (!titles) return { errors: [`没有 Locale "${locale}" 的章节标题`] }

  const errors: string[] = []
  const { lead, blocks } = splitByHeading(body, 2)

  if (/^#\s/m.test(lead)) errors.push("正文不要写 H1，标题由页面生成")
  const definition = lead.replace(/^#\s.*$/m, "").trim()
  if (!definition) errors.push("缺少一段话定义（第一个 H2 之前）")
  else if (/\n\s*\n/.test(definition)) errors.push("一段话定义只能有一段")

  const byTitle = new Map(Object.entries(titles).map(([key, title]) => [title, key as SectionKey]))
  const sections: Partial<Record<SectionKey, string>> = {}
  const order: number[] = []
  for (const block of blocks) {
    const key = byTitle.get(block.heading)
    if (!key) {
      errors.push(`未知章节 "## ${block.heading}"，可用：${Object.values(titles).join("、")}`)
      continue
    }
    if (key in sections) errors.push(`章节 "## ${block.heading}" 重复`)
    if (!block.body) errors.push(`章节 "## ${block.heading}" 是空的`)
    sections[key] = block.body
    order.push(SECTIONS.findIndex((s) => s.key === key))
  }
  for (const spec of SECTIONS) {
    if (spec.required && !(spec.key in sections)) errors.push(`缺少必填章节 "## ${titles[spec.key]}"`)
  }
  if (order.some((index, i) => i > 0 && index < order[i - 1]!)) {
    errors.push(`章节顺序必须是：${SECTIONS.map((s) => titles[s.key]).join(" → ")}`)
  }

  const faq: FaqItem[] = []
  if (sections.faq) {
    const { lead: faqLead, blocks: items } = splitByHeading(sections.faq, 3)
    if (faqLead) errors.push("FAQ 里每个问题都要用 ### 开头")
    if (!items.length) errors.push("FAQ 至少要有一个问题")
    for (const item of items) {
      if (!item.heading.endsWith("?")) errors.push(`FAQ 问题要写成完整问句：${item.heading}`)
      if (!item.body) errors.push(`FAQ 问题没有回答：${item.heading}`)
      faq.push({ question: item.heading, answer: item.body })
    }
  }

  return errors.length ? { errors } : { doc: { definition, sections, faq }, errors }
}

/** 把 Markdown 原文粗略转成纯文本，用于结构化数据。 */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\s*\n\s*/g, " ")
    .trim()
}
