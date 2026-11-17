import type { APIRoute } from "astro"
import { absoluteUrl } from "@/lib/site"

/**
 * 自己维护 robots.txt，放行全部爬虫（含 AI 爬虫），显式声明内容使用偏好（design.md 4.3）。
 * Game Bundle 用 X-Robots-Tag 排除收录，这里不 Disallow，避免爬虫看不到 noindex。
 */
export const GET: APIRoute = () =>
  new Response(
    [
      "User-agent: *",
      "Content-Signal: search=yes, ai-input=yes, ai-train=yes",
      "Allow: /",
      "",
      `Sitemap: ${absoluteUrl("/sitemap.xml")}`,
      "",
    ].join("\n"),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  )
