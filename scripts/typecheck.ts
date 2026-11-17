/**
 * 类型检查：站点、Game Contract、每个 Game，以及每个 Game 的 Kernel（独立的 tsconfig.core.json，不含 DOM）。
 * 新增 Game 不需要改这里，按目录自动发现。
 */
import { Glob } from "bun"
import { existsSync } from "node:fs"
import path from "node:path"
import { root, siteDir } from "./lib"

const tsc = path.join(root, "node_modules/.bin/tsc")
const errors: string[] = []

function run(label: string, cmd: string[], cwd = root) {
  console.log(`$ ${label}`)
  const { exitCode } = Bun.spawnSync(cmd, { cwd, stdio: ["inherit", "inherit", "inherit"] })
  if (exitCode !== 0) errors.push(label)
}

run("astro check", ["bun", "astro", "check"], siteDir)
run("tsc -p packages/game-contract", [tsc, "-p", "packages/game-contract"])

for await (const file of new Glob("games/*/tsconfig.json").scan(root)) {
  const dir = path.dirname(file)
  run(`tsc -p ${dir}`, [tsc, "-p", dir])

  const coreDir = path.join(dir, "src/core")
  if (!existsSync(path.join(root, coreDir))) continue
  const coreConfig = path.join(root, coreDir, "tsconfig.json")
  if (!existsSync(coreConfig)) {
    errors.push(`${coreDir}/tsconfig.json 缺失，必须继承根目录的 tsconfig.core.json`)
    continue
  }
  const text = await Bun.file(coreConfig).text()
  if (!/"extends"\s*:\s*"[^"]*tsconfig\.core\.json"/.test(text)) {
    errors.push(`${coreDir}/tsconfig.json 必须继承根目录的 tsconfig.core.json`)
    continue
  }
  run(`tsc -p ${coreDir}`, [tsc, "-p", coreDir])
}

if (errors.length) {
  console.error(`\n类型检查失败：\n${errors.map((e) => `  - ${e}`).join("\n")}`)
  process.exit(1)
}
