import type { APIRoute } from "astro"
import { absoluteUrl, categories, games, guides, pages, paths, siteUpdated } from "@/lib/site"
import { isoDate } from "@/lib/ui-text"

/** 只列可收录的 HTML 页面；/play/ 与 .md 版本不进站点地图。 */
export const GET: APIRoute = () => {
  const entries = [
    { path: paths.home, updated: siteUpdated },
    ...games.map((g) => ({ path: paths.game(g.slug), updated: g.updated })),
    ...categories.map((c) => ({ path: paths.category(c.id), updated: c.updated })),
    ...guides.map((g) => ({ path: paths.guide(g.slug), updated: g.updated })),
    ...pages.map((p) => ({ path: paths.page(p.slug), updated: p.updated })),
  ]
  const urls = entries
    .map(
      (e) => `  <url>\n    <loc>${absoluteUrl(e.path)}</loc>\n    <lastmod>${isoDate(e.updated)}</lastmod>\n  </url>`,
    )
    .join("\n")
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  )
}
