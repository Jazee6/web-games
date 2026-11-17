import { defineCollection } from "astro:content"
import { glob } from "astro/loaders"
import { z } from "astro/zod"

const date = z.coerce.date()
/** 搜索结果摘要的合理长度。 */
const description = z.string().min(50).max(160)

/** Game Content：games/<slug>/content/<locale>.md，id 为 <slug>/<locale>。章节在 src/lib/site.ts 校验。 */
const gameContent = defineCollection({
  loader: glob({
    base: "../../games",
    pattern: "*/content/*.md",
    generateId: ({ entry }) => entry.replace("/content/", "/").replace(/\.md$/, ""),
  }),
  schema: z.strictObject({
    /** 可选，默认 "<name> – Play Free Online"。 */
    title: z.string().max(70).optional(),
    description,
    updated: date,
  }),
})

/** Category 清单：content/categories/<id>.md，正文是介绍文字。 */
const categories = defineCollection({
  loader: glob({ base: "../../content/categories", pattern: "*.md" }),
  schema: z.strictObject({
    name: z.string(),
    title: z.string().max(70),
    description,
    updated: date,
  }),
})

const guides = defineCollection({
  loader: glob({ base: "../../content/guides", pattern: "*.md" }),
  schema: z.strictObject({
    title: z.string().max(70),
    description,
    /** 关联的 Game slug。 */
    games: z.array(z.string()).default([]),
    published: date,
    updated: date,
    draft: z.boolean().default(false),
  }),
})

/** 关于 / 隐私 / 条款等独立页面：content/pages/<slug>.md。 */
const pages = defineCollection({
  loader: glob({ base: "../../content/pages", pattern: "*.md" }),
  schema: z.strictObject({
    title: z.string().max(70),
    description,
    updated: date,
  }),
})

export const collections = { gameContent, categories, guides, pages }
