/**
 * 构建产物检查（design.md 第 7 节）：任一不通过则构建失败。
 * - 结构化数据：每段 JSON-LD 可解析，各页面类型带齐规定的类型与必需字段。
 * - 站内链接：href / src 指向的地址在产物里都存在。
 * - Markdown 版本：rel=alternate 指向的 .md 存在。
 * - 点击“开始”前不加载 React：页面不直接引用水合运行时。
 */
import { Glob } from "bun"
import { existsSync } from "node:fs"
import path from "node:path"
import { distDir } from "./lib"

type JsonLd = Record<string, unknown>

/** 各页面类型必须带的 JSON-LD 类型（design.md 4.2）。 */
const EXPECTED: [RegExp, string[]][] = [
  [/^index\.html$/, ["WebSite", "Organization", "ItemList"]],
  [/^games\/[^/]+\/index\.html$/, ["VideoGame", "FAQPage", "BreadcrumbList"]],
  [/^[^/]+-games\/index\.html$/, ["CollectionPage", "ItemList", "BreadcrumbList"]],
  [/^guides\/[^/]+\/index\.html$/, ["Article", "BreadcrumbList"]],
  [/^[^/]+\/index\.html$/, ["BreadcrumbList"]],
]

const nonEmpty = (v: unknown) => Array.isArray(v) && v.length > 0
const REQUIRED: Record<string, (d: JsonLd) => boolean> = {
  VideoGame: (d) => Boolean(d.name && d.url && d.image && d.description),
  FAQPage: (d) => nonEmpty(d.mainEntity),
  BreadcrumbList: (d) => nonEmpty(d.itemListElement),
  ItemList: (d) => Array.isArray(d.itemListElement),
  Article: (d) => Boolean(d.headline && d.image && d.datePublished && d.dateModified),
  CollectionPage: (d) => Boolean(d.name && d.url),
  WebSite: (d) => Boolean(d.name && d.url),
  Organization: (d) => Boolean(d.name && d.url),
}

/** 站内地址是否对应产物里的文件（目录地址对应 index.html）。 */
function exists(urlPath: string) {
  const clean = decodeURI(urlPath.split(/[?#]/)[0]!)
  const file = path.join(distDir, clean)
  return clean.endsWith("/") ? existsSync(path.join(file, "index.html")) : existsSync(file)
}

export async function checkDist() {
  const errors: string[] = []
  for await (const file of new Glob("**/*.html").scan(distDir)) {
    if (file.startsWith("play/")) continue
    const html = await Bun.file(path.join(distDir, file)).text()
    const at = (msg: string) => errors.push(`${file}: ${msg}`)

    const types: string[] = []
    for (const [, json] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let data: JsonLd
      try {
        data = JSON.parse(json!)
      } catch {
        at("JSON-LD 无法解析")
        continue
      }
      const type = String(data["@type"])
      types.push(type)
      if (data["@context"] !== "https://schema.org") at(`${type} 缺少 @context`)
      if (REQUIRED[type] && !REQUIRED[type](data)) at(`${type} 缺少必需字段`)
    }
    const expected = EXPECTED.find(([pattern]) => pattern.test(file))?.[1]
    if (expected && file !== "404.html") {
      for (const type of expected) if (!types.includes(type)) at(`缺少 JSON-LD ${type}`)
    }

    for (const [, url] of html.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)) {
      if (!exists(url!)) at(`站内链接失效：${url}`)
    }
    if (!/<link rel="alternate" type="text\/markdown" href="[^"]+\.md">/.test(html) && file !== "404.html") {
      at("缺少 Markdown 版本的 rel=alternate")
    }
    for (const [, src] of html.matchAll(/<script[^>]*\ssrc="([^"]+)"/g)) {
      if (/\/(client|mount)\.[^/]*\.js$/.test(src!)) at(`点击“开始”前加载了 React：${src}`)
    }
  }
  if (errors.length) throw new Error(`产物检查失败：\n${errors.map((e) => `  - ${e}`).join("\n")}`)
}

if (import.meta.main) await checkDist()
