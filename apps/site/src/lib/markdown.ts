/**
 * 每个页面的 Markdown 版本（design.md 4.3）。与 HTML 用同一份数据：
 * 正文是作者写的原文，生成部分（关联 Guide、相关 Game、列表）与 HTML 页面调用同样的函数。
 */
import {
  type Category,
  type Game,
  type Guide,
  type Page,
  SITE,
  absoluteUrl,
  categories,
  categoryOf,
  categoryPath,
  games,
  guides,
  guidesFor,
  paths,
  relatedGames,
  siteUpdated,
} from "./site"
import { isoDate, text } from "./ui-text"

interface Link {
  name: string
  path: string
  description: string
}

const list = (links: Link[]) => links.map((l) => `- [${l.name}](${absoluteUrl(l.path)}): ${l.description}`).join("\n")
const gameLinks = (items: Game[]) =>
  items.map((g) => ({ name: g.name, path: paths.game(g.slug), description: g.description }))
const guideLinks = (items: Guide[]) =>
  items.map((g) => ({ name: g.title, path: paths.guide(g.slug), description: g.description }))
const categoryLinks = (items: Category[]) =>
  items.map((c) => ({
    name: text.gamesInCategory(c.name),
    path: paths.category(c.id),
    description: c.description,
  }))

function document(title: string, blocks: (string | false | undefined)[], updated: Date) {
  return [`# ${title}`, ...blocks.filter(Boolean), `${text.lastUpdated}: ${isoDate(updated)}`].join("\n\n") + "\n"
}

const section = (heading: string, links: Link[]) => links.length > 0 && `## ${heading}\n\n${list(links)}`

export function homeMarkdown() {
  return document(
    SITE.name,
    [
      SITE.description,
      section(text.games, gameLinks(games)),
      categories.length > 0 && section("Categories", categoryLinks(categories)),
      section(text.guides, guideLinks(guides)),
    ],
    siteUpdated,
  )
}

export function gameMarkdown(game: Game) {
  const category = categoryOf(game)
  const categoryUrl = categoryPath(category)
  return document(
    game.name,
    [
      `${text.playOnline(game.name)} ${absoluteUrl(paths.game(game.slug))}`,
      game.entry.body!.trim(),
      section(text.guides, guideLinks(guidesFor(game))),
      section(text.relatedGames, gameLinks(relatedGames(game))),
      categoryUrl && `Category: [${text.gamesInCategory(category.name)}](${absoluteUrl(categoryUrl)})`,
    ],
    game.updated,
  )
}

export function categoryMarkdown(category: Category) {
  return document(
    text.gamesInCategory(category.name),
    [category.entry.body!.trim(), section(text.games, gameLinks(category.games))],
    category.updated,
  )
}

export function guideMarkdown(guide: Guide) {
  return document(guide.title, [guide.entry.body!.trim(), section(text.games, gameLinks(guide.games))], guide.updated)
}

export function pageMarkdown(page: Page) {
  return document(page.title, [page.entry.body!.trim()], page.updated)
}

/** /llms.txt：站点简介与全部 Game、Category、Guide 的 Markdown 地址（llmstxt.org）。 */
export function llmsTxt() {
  const md = (links: Link[]) => links.map((l) => ({ ...l, path: paths.markdown(l.path) }))
  return (
    [
      `# ${SITE.name}`,
      `> ${SITE.description}`,
      `All games are free, run in the browser on phone and desktop, and need no account. Each link below is the Markdown version of a page; the HTML page is the same address without ".md" and with a trailing slash.`,
      section(text.games, md(gameLinks(games))),
      categories.length > 0 && section("Categories", md(categoryLinks(categories))),
      section(text.guides, md(guideLinks(guides))),
    ]
      .filter(Boolean)
      .join("\n\n") + "\n"
  )
}

export function markdownResponse(body: string) {
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } })
}
