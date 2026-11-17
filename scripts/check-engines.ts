/**
 * 回放金标跨引擎一致性（docs/architecture/README.md 第 9、10 节）。
 *
 * 约定：Game 的 src/core/golden.ts 导出 `goldenHashes(): Record<string, string>`，
 * 重演全部 Replay 金标与固定日期的 Daily Puzzle，返回 名称 → hash(state)。
 * 本脚本分别在 Bun（JavaScriptCore）与 Node（V8）上运行它，结果必须完全一致。
 * 与已提交金标的比对由 Game 自己的 bun test 负责。
 */
import { Glob } from "bun"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { root } from "./lib"

type Hashes = Record<string, string>

export async function checkEngines() {
  const files = await Array.fromAsync(new Glob("games/*/src/core/golden.ts").scan(root))
  if (!files.length) return

  if (Bun.spawnSync(["node", "--version"]).exitCode !== 0) {
    throw new Error("跨引擎检查需要 Node（V8），当前环境找不到 node")
  }

  const tmp = await mkdtemp(path.join(tmpdir(), "golden-"))
  const errors: string[] = []
  try {
    for (const file of files) {
      const slug = file.split("/")[1]!
      const entry = path.join(root, file)
      const onBun = (await import(entry)).goldenHashes() as Hashes

      const outdir = path.join(tmp, slug)
      const built = await Bun.build({
        entrypoints: [entry],
        outdir,
        target: "node",
        format: "esm",
        naming: "golden.mjs",
      })
      if (!built.success) {
        for (const log of built.logs) console.error(log)
        errors.push(`${slug}: golden.ts 无法为 Node 打包`)
        continue
      }
      const url = pathToFileURL(path.join(outdir, "golden.mjs")).href
      const node = Bun.spawnSync([
        "node",
        "--input-type=module",
        "-e",
        `const m = await import(${JSON.stringify(url)}); process.stdout.write(JSON.stringify(m.goldenHashes()))`,
      ])
      if (node.exitCode !== 0) {
        errors.push(`${slug}: Node 运行 golden.ts 失败\n${node.stderr.toString()}`)
        continue
      }
      const onNode = JSON.parse(node.stdout.toString()) as Hashes

      const names = [...new Set([...Object.keys(onBun), ...Object.keys(onNode)])]
      if (!names.length) errors.push(`${slug}: goldenHashes() 返回为空`)
      for (const name of names) {
        if (onBun[name] !== onNode[name]) {
          errors.push(`${slug}: ${name} 哈希不一致（Bun ${onBun[name]}，Node ${onNode[name]}）`)
        }
      }
      console.log(`golden ${slug}: ${names.length} 项，Bun 与 Node 一致性检查完成`)
    }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
  if (errors.length) throw new Error(`跨引擎检查失败：\n${errors.map((e) => `  - ${e}`).join("\n")}`)
}

if (import.meta.main) await checkEngines()
