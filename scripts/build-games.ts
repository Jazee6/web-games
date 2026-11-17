/**
 * 把每个 Game 构建为 Game Bundle，输出到站点的 public/play/<slug>/，
 * Astro 构建时会原样拷贝到产物的 /play/<slug>/。
 *
 * - DOM Tier 的 .tsx 经 Babel（babel-preset-solid）编译（docs/architecture/dom.md 第 2 节）。
 * - src/workers/*.worker.ts 单独构建到 /play/<slug>/workers/<name>.worker.js（README 第 7 节）。
 * - 体积预算与存储 API 扫描覆盖全部产物，包括 Worker（README 第 10、12 节）。
 * - src/core/ 的隔离检查（ADR-0004）。
 */
import { transformAsync } from "@babel/core"
import { Glob, type BunPlugin } from "bun"
import { rm } from "node:fs/promises"
import path from "node:path"
import { checkCore } from "./check-core"
import { DEFAULT_BUDGET_BYTES, MAX_BUDGET_BYTES, loadGames, playDir, type Tier } from "./lib"

/** Game 不得直接访问浏览器存储，Save 一律经 Game Contract（ADR-0002）。 */
const FORBIDDEN_APIS = /\b(localStorage|sessionStorage|indexedDB)\b/

/** 把 Solid JSX 编译为细粒度 DOM 更新；类型在同一次转换中去掉。 */
const solidPlugin: BunPlugin = {
  name: "solid",
  setup(build) {
    build.onLoad({ filter: /\.tsx$/ }, async ({ path: file }) => {
      const result = await transformAsync(await Bun.file(file).text(), {
        filename: file,
        babelrc: false,
        configFile: false,
        presets: [["babel-preset-solid", { generate: "dom" }], "@babel/preset-typescript"],
      })
      return { contents: result!.code!, loader: "js" }
    })
  },
}

const PLUGINS: Record<Tier, BunPlugin[]> = { dom: [solidPlugin], "2d": [], "2.5d": [], "3d": [] }

export async function buildGames() {
  await rm(playDir, { recursive: true, force: true })
  const games = await loadGames()
  const errors: string[] = []

  for (const game of games) {
    errors.push(...(await checkCore(game.dir, game.slug)))

    const outdir = path.join(playDir, game.slug)
    const common = { minify: true, target: "browser", plugins: PLUGINS[game.tier] } as const
    const builds = [
      await Bun.build({
        ...common,
        entrypoints: [path.join(game.dir, "index.html")],
        outdir,
        publicPath: `/play/${game.slug}/`,
      }),
    ]

    const workers = await Array.fromAsync(new Glob("src/workers/*.worker.ts").scan(game.dir))
    if (workers.length) {
      builds.push(
        await Bun.build({
          ...common,
          entrypoints: workers.map((w) => path.join(game.dir, w)),
          outdir: path.join(outdir, "workers"),
          naming: "[name].[ext]",
          format: "esm",
        }),
      )
    }

    let total = 0
    for (const result of builds) {
      if (!result.success) {
        for (const log of result.logs) console.error(log)
        errors.push(`${game.slug}: 构建失败`)
        continue
      }
      for (const output of result.outputs) {
        total += output.size
        const text = /\.(js|html|css)$/.test(output.path) ? await output.text() : ""
        if (FORBIDDEN_APIS.test(text)) {
          errors.push(
            `${game.slug}: ${path.relative(outdir, output.path)} 直接访问了浏览器存储，Save 必须经 Game Contract`,
          )
        }
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
