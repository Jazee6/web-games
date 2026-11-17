/**
 * 站点的全部内容模型：Game、Category、Guide、独立页面。
 * 模块加载时校验，任何错误都让构建失败（design.md 第 7 节）。
 */
import type { ImageMetadata } from "astro"
import { type CollectionEntry, getCollection } from "astro:content"
import { type GameMeta, validateGameMeta } from "../../../../scripts/game-meta"
import { type GameContentDoc, parseGameContent } from "./game-content"

export const SITE = {
  name: "Web Games",
  description: "Free puzzle games that run in your browser. No download, no account, works on phone and desktop.",
  /** 首发只输出默认 Locale。 */
  locale: "en",
}

export interface Game extends GameMeta {
  coverImage: ImageMetadata
  title: string
  description: string
  updated: Date
  entry: CollectionEntry<"gameContent">
  doc: GameContentDoc
}

export interface Category {
  id: string
  name: string
  title: string
  description: string
  /** 介绍文字与其下 Game 中最新的日期。 */
  updated: Date
  entry: CollectionEntry<"categories">
  games: Game[]
}

export interface Guide {
  slug: string
  title: string
  description: string
  published: Date
  updated: Date
  entry: CollectionEntry<"guides">
  games: Game[]
}

export interface Page {
  slug: string
  title: string
  description: string
  updated: Date
  entry: CollectionEntry<"pages">
}

/** Category 下少于这个数量的 Game 时不生成 Category Page（ADR-0003）。 */
export const MIN_GAMES_PER_CATEGORY = 2
const RELATED_GAMES = 4

/** 与 scripts/lib.ts 一致：只有主分支的正式构建排除草稿。 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {}
const includeDrafts = env.WORKERS_CI_BRANCH !== "main"

export const paths = {
  home: "/",
  game: (slug: string) => `/games/${slug}/`,
  category: (id: string) => `/${id}-games/`,
  guide: (slug: string) => `/guides/${slug}/`,
  page: (slug: string) => `/${slug}/`,
  play: (slug: string) => `/play/${slug}/`,
  /** 页面的 Markdown 版本：/games/x/ → /games/x.md，/ → /index.md。 */
  markdown: (path: string) => (path === "/" ? "/index.md" : `${path.slice(0, -1)}.md`),
}

export function absoluteUrl(path: string) {
  return new URL(path, import.meta.env.SITE).href
}

const errors: string[] = []

const metas = import.meta.glob<GameMeta>("../../../../games/*/game.json", {
  eager: true,
  import: "default",
})
const covers = import.meta.glob<ImageMetadata>("../../../../games/*/*.{svg,png,jpg,jpeg,webp,avif}", {
  eager: true,
  import: "default",
})

const contentEntries = await getCollection("gameContent")
const contentById = new Map(contentEntries.map((entry) => [entry.id, entry]))
const categoryEntries = await getCollection("categories")
const categoryIds = new Set(categoryEntries.map((entry) => entry.id))

const allGames: Game[] = []
for (const [file, meta] of Object.entries(metas)) {
  const dir = file.slice(0, file.lastIndexOf("/"))
  const dirName = dir.slice(dir.lastIndexOf("/") + 1)
  const metaErrors = validateGameMeta(meta, dirName)
  if (metaErrors.length) {
    errors.push(...metaErrors)
    continue
  }
  const where = `games/${meta.slug}`
  const coverImage = covers[`${dir}/${meta.cover}`]
  if (!coverImage) errors.push(`${where}/game.json: 找不到封面 ${meta.cover}`)
  if (!categoryIds.has(meta.category)) {
    errors.push(`${where}/game.json: Category "${meta.category}" 不在 content/categories/ 清单里`)
  }
  const entry = contentById.get(`${meta.slug}/${SITE.locale}`)
  if (!entry) {
    errors.push(`${where}/content/${SITE.locale}.md: 缺少 Game Content`)
    continue
  }
  const { doc, errors: contentErrors } = parseGameContent(entry.body ?? "", SITE.locale)
  errors.push(...contentErrors.map((e) => `${where}/content/${SITE.locale}.md: ${e}`))
  if (!doc || !coverImage) continue
  allGames.push({
    ...meta,
    coverImage,
    title: entry.data.title ?? `${meta.name} – Play Free Online`,
    description: entry.data.description,
    updated: entry.data.updated,
    entry,
    doc,
  })
}
for (const entry of contentEntries) {
  const slug = entry.id.split("/")[0]!
  if (!Object.values(metas).some((meta) => meta.slug === slug)) {
    errors.push(`games/${slug}/content/: 没有对应的 game.json`)
  }
}

const allSlugs = new Set(allGames.map((game) => game.slug))
export const games = allGames
  .filter((game) => includeDrafts || !game.draft)
  .sort((a, b) => a.name.localeCompare(b.name))
const gameBySlug = new Map(games.map((game) => [game.slug, game]))

for (const game of games) {
  for (const slug of game.related ?? []) {
    if (!allSlugs.has(slug)) errors.push(`games/${game.slug}/game.json: related 里的 "${slug}" 不存在`)
    else if (!gameBySlug.has(slug)) errors.push(`games/${game.slug}/game.json: related 里的 "${slug}" 是草稿`)
  }
}

export const allCategories: Category[] = categoryEntries.map((entry) => {
  const categoryGames = games.filter((game) => game.category === entry.id)
  return {
    id: entry.id,
    name: entry.data.name,
    title: entry.data.title,
    description: entry.data.description,
    updated: latest([entry.data.updated, ...categoryGames.map((game) => game.updated)]),
    entry,
    games: categoryGames,
  }
})

/** 有 Category Page 的 Category：进导航、站点地图和 llms.txt。 */
export const categories = allCategories.filter((category) => category.games.length >= MIN_GAMES_PER_CATEGORY)

export const guides: Guide[] = (await getCollection("guides"))
  .filter((entry) => includeDrafts || !entry.data.draft)
  .map((entry) => {
    const guideGames: Game[] = []
    for (const slug of entry.data.games) {
      const game = gameBySlug.get(slug)
      if (game) guideGames.push(game)
      else if (allSlugs.has(slug)) errors.push(`content/guides/${entry.id}.md: 关联的 Game "${slug}" 是草稿`)
      else errors.push(`content/guides/${entry.id}.md: 关联的 Game "${slug}" 不存在`)
    }
    return {
      slug: entry.id,
      title: entry.data.title,
      description: entry.data.description,
      published: entry.data.published,
      updated: entry.data.updated,
      entry,
      games: guideGames,
    }
  })
  .sort((a, b) => b.published.getTime() - a.published.getTime())

export const pages: Page[] = (await getCollection("pages")).map((entry) => ({
  slug: entry.id,
  title: entry.data.title,
  description: entry.data.description,
  updated: entry.data.updated,
  entry,
}))

for (const page of pages) {
  if (page.slug.endsWith("-games") || ["games", "guides", "play"].includes(page.slug)) {
    errors.push(`content/pages/${page.slug}.md: slug 与站点保留路径冲突（ADR-0003）`)
  }
}

if (errors.length) throw new Error(`内容校验失败：\n${errors.map((e) => `  - ${e}`).join("\n")}`)

export function categoryOf(game: Game): Category {
  return allCategories.find((category) => category.id === game.category)!
}

/** Category 有 Category Page 时才返回其地址。 */
export function categoryPath(category: Category): string | undefined {
  return categories.includes(category) ? paths.category(category.id) : undefined
}

/** 相关 Game：先取 game.json 指定的，再用同 Category 的补足。 */
export function relatedGames(game: Game): Game[] {
  const picked = (game.related ?? []).map((slug) => gameBySlug.get(slug)!)
  for (const other of games) {
    if (picked.length >= RELATED_GAMES) break
    if (other !== game && other.category === game.category && !picked.includes(other)) picked.push(other)
  }
  return picked.slice(0, RELATED_GAMES)
}

export function guidesFor(game: Game): Guide[] {
  return guides.filter((guide) => guide.games.includes(game))
}

export function latest(dates: Date[]): Date {
  return new Date(Math.max(...dates.map((d) => d.getTime())))
}

export const siteUpdated = latest([
  ...games.map((g) => g.updated),
  ...categories.map((c) => c.updated),
  ...guides.map((g) => g.updated),
  ...pages.map((p) => p.updated),
])
