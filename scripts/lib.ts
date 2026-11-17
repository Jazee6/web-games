import { Glob } from "bun"
import path from "node:path"
import { type GameMeta, validateGameMeta } from "./game-meta"

export * from "./game-meta"

export const root = path.resolve(import.meta.dir, "..")
export const siteDir = path.join(root, "apps/site")
export const distDir = path.join(siteDir, "dist")
export const playDir = path.join(siteDir, "public/play")

/** 只有 Workers Builds 构建主分支时才是正式发布；其他情况（预览分支、本地）整站 noindex 并包含草稿。 */
export const isProduction = process.env.WORKERS_CI_BRANCH === "main"

export async function loadGames(): Promise<(GameMeta & { dir: string })[]> {
  const games = []
  const errors: string[] = []
  for await (const file of new Glob("games/*/game.json").scan(root)) {
    const dir = path.join(root, path.dirname(file))
    const meta = (await Bun.file(path.join(root, file)).json()) as GameMeta
    errors.push(...validateGameMeta(meta, path.basename(dir)))
    if (meta.draft && isProduction) continue
    games.push({ ...meta, dir })
  }
  if (errors.length) throw new Error(errors.join("\n"))
  return games.sort((a, b) => a.slug.localeCompare(b.slug))
}
