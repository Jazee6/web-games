/** 站点界面文字。新增 Locale 时在这里加一份。 */
const TEXT = {
  en: {
    home: "Home",
    guides: "Guides",
    relatedGames: "Related Games",
    games: "Games",
    playOnline: (name: string) => `Play ${name} online for free in your browser:`,
    lastUpdated: "Last updated",
    breadcrumb: "Breadcrumb",
    mainNav: "Main",
    gamesInCategory: (name: string) => `${name} Games`,
  },
}

export const text = TEXT.en

export function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  })
}

export const isoDate = (date: Date) => date.toISOString().slice(0, 10)
