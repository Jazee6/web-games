/**
 * 完整构建：Game Bundle → 回放金标跨引擎检查 → 站点 → 平台规则文件（_headers、_redirects）→ 产物检查。
 */
import { copyFile } from "node:fs/promises"
import path from "node:path"
import { buildGames } from "./build-games"
import { checkDist } from "./check-dist"
import { checkEngines } from "./check-engines"
import { distDir, isProduction, root, siteDir } from "./lib"

await buildGames()
await checkEngines()

const astro = Bun.spawnSync(["bun", "astro", "build"], {
  cwd: siteDir,
  stdio: ["inherit", "inherit", "inherit"],
})
if (astro.exitCode !== 0) process.exit(astro.exitCode ?? 1)

const headers = [
  // Game Bundle 不被收录（ADR-0002）。
  "/play/*",
  "  X-Robots-Tag: noindex",
]
if (!isProduction) {
  // 预览分支与本地构建整站 noindex。
  headers.push("/*", "  X-Robots-Tag: noindex")
}
await Bun.write(path.join(distDir, "_headers"), headers.join("\n") + "\n")
await copyFile(path.join(root, "redirects"), path.join(distDir, "_redirects"))
await checkDist()

console.log(`\n构建完成（${isProduction ? "正式" : "预览，整站 noindex"}）：${path.relative(root, distDir)}`)
