/**
 * 把每个 Game 构建为 Game Bundle，输出到站点的 public/play/<slug>/，
 * Astro 构建时会原样拷贝到产物的 /play/<slug>/。
 */
import { rm } from "node:fs/promises"
import path from "node:path"
import { DEFAULT_BUDGET_BYTES, MAX_BUDGET_BYTES, loadGames, playDir } from "./lib"

/** Game 不得直接访问浏览器存储，Save 一律经 Game Contract（ADR-0002）。 */
const FORBIDDEN_APIS = /\b(localStorage|sessionStorage|indexedDB)\b/

export async function buildGames() {
  await rm(playDir, { recursive: true, force: true })
  const games = await loadGames()
  const errors: string[] = []

  for (const game of games) {
    const outdir = path.join(playDir, game.slug)
    const result = await Bun.build({
      entrypoints: [path.join(game.dir, "index.html")],
      outdir,
      publicPath: `/play/${game.slug}/`,
      minify: true,
      target: "browser",
    })
    if (!result.success) {
      for (const log of result.logs) console.error(log)
      errors.push(`${game.slug}: 构建失败`)
      continue
    }

    let total = 0
    for (const output of result.outputs) {
      total += output.size
      const text = /\.(js|html|css)$/.test(output.path) ? await output.text() : ""
      if (FORBIDDEN_APIS.test(text)) {
        errors.push(`${game.slug}: ${path.basename(output.path)} 直接访问了浏览器存储，Save 必须经 Game Contract`)
      }
    }

    const budget = game.budgetBytes ?? DEFAULT_BUDGET_BYTES[game.tier]
    if (budget > MAX_BUDGET_BYTES) errors.push(`${game.slug}: budgetBytes 超过 10 MB 上限`)
    if (total > budget) {
      errors.push(`${game.slug}: Game Bundle ${formatBytes(total)} 超出预算 ${formatBytes(budget)}`)
    }
    console.log(`play/${game.slug}/  ${formatBytes(total)} / ${formatBytes(budget)}`)
  }

  if (errors.length) throw new Error(errors.join("\n"))
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

if (import.meta.main) await buildGames()
