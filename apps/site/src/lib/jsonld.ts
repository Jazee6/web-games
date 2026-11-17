/**
 * 结构化数据（design.md 4.2）。每个函数返回一个 JSON-LD 对象，由布局统一输出。
 */
import { markdownToText } from "./game-content"
import { type Category, type Game, type Guide, SITE, absoluteUrl, paths } from "./site"

export type JsonLd = Record<string, unknown>

export interface Crumb {
  name: string
  path: string
}

const ORGANIZATION_ID = absoluteUrl("/#organization")
const WEBSITE_ID = absoluteUrl("/#website")

/** 其他页面没有 Organization 节点，引用时带上名称和地址。 */
const publisher = () => ({
  "@type": "Organization",
  "@id": ORGANIZATION_ID,
  name: SITE.name,
  url: absoluteUrl("/"),
})

const date = (d: Date) => d.toISOString().slice(0, 10)

export function organization(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: SITE.name,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/favicon.svg"),
  }
}

export function website(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE.name,
    description: SITE.description,
    url: absoluteUrl("/"),
    inLanguage: SITE.locale,
    publisher: publisher(),
  }
}

export function itemList(items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  }
}

export function breadcrumbList(crumbs: Crumb[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  }
}

export function videoGame(game: Game, category: Category, image: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.name,
    description: markdownToText(game.doc.definition),
    url: absoluteUrl(paths.game(game.slug)),
    image,
    genre: category.name,
    gamePlatform: "Web browser",
    applicationCategory: "Game",
    operatingSystem: "Any",
    inLanguage: SITE.locale,
    isAccessibleForFree: true,
    dateModified: date(game.updated),
    offers: { "@type": "Offer", price: 0, priceCurrency: "USD" },
    publisher: publisher(),
  }
}

export function faqPage(game: Game): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: game.doc.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: markdownToText(item.answer) },
    })),
  }
}

export function collectionPage(category: Category): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.title,
    description: category.description,
    url: absoluteUrl(paths.category(category.id)),
    inLanguage: SITE.locale,
    dateModified: date(category.updated),
    isPartOf: { "@type": "WebSite", "@id": WEBSITE_ID, name: SITE.name, url: absoluteUrl("/") },
  }
}

export function article(guide: Guide, image: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    url: absoluteUrl(paths.guide(guide.slug)),
    image,
    inLanguage: SITE.locale,
    datePublished: date(guide.published),
    dateModified: date(guide.updated),
    author: publisher(),
    publisher: publisher(),
    about: guide.games.map((game) => ({
      "@type": "VideoGame",
      name: game.name,
      url: absoluteUrl(paths.game(game.slug)),
    })),
  }
}
