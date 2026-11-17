/**
 * Kernel 隔离检查（ADR-0004，docs/architecture/README.md 第 4.2、10 节）。
 * 扫描 games/<slug>/src/core/ 的非测试源码，拦截 tsconfig（lib: ES2022）覆盖不到的禁用项：
 * - 不确定的 API：Math.random、超越函数、`**`、Date、locale 相关方法等；
 * - 浏览器与宿主全局（即便类型检查漏掉，也在这里再拦一次）；
 * - import 外层目录或任何包。
 */
import { Glob } from "bun"
import path from "node:path"

/** 规范只要求近似、各引擎结果可能不同的 Math 方法，以及 Math.random。 */
const MATH_BANNED = [
  "random",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "atan2",
  "sinh",
  "cosh",
  "tanh",
  "asinh",
  "acosh",
  "atanh",
  "exp",
  "expm1",
  "log",
  "log1p",
  "log2",
  "log10",
  "pow",
  "hypot",
  "cbrt",
]
const MATH_RE = new RegExp(`\\bMath\\s*(?:\\.\\s*|\\[\\s*["'\`])(${MATH_BANNED.join("|")})\\b`, "g")

/** 不可重现或依赖宿主环境的全局。前面不能是 `.`，避免误伤同名属性。 */
const GLOBALS_BANNED = [
  "Date",
  "performance",
  "crypto",
  "Intl",
  "window",
  "document",
  "navigator",
  "globalThis",
  "self",
  "location",
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "setTimeout",
  "setInterval",
  "requestAnimationFrame",
  "queueMicrotask",
  "process",
  "Bun",
]
const GLOBALS_RE = new RegExp(`(?<![\\w$.])(${GLOBALS_BANNED.join("|")})\\b`, "g")

/** 结果依赖运行环境 locale 的方法。排序请用全序比较器。 */
const LOCALE_RE = /\.\s*(localeCompare|toLocale\w*)\b/g

const POW_RE = /\*\*/g

const transpiler = new Bun.Transpiler({ loader: "ts" })

/** 把字符串与模板字面量的内容清空，避免误报。 */
function stripStrings(code: string) {
  return code.replace(/(["'`])(?:\\[\s\S]|(?!\1)[^\\])*\1/g, '""')
}

/** 检查一份 core 源码，返回问题列表（不含文件名）。coreDir 与 file 用于判断相对 import 是否越界。 */
export function checkCoreSource(source: string, file: string, coreDir: string): string[] {
  const problems: string[] = []

  for (const { path: spec } of transpiler.scanImports(source)) {
    if (!spec.startsWith(".")) {
      problems.push(`不得 import 包或外部模块："${spec}"`)
      continue
    }
    const target = path.resolve(path.dirname(file), spec)
    const rel = path.relative(coreDir, target)
    if (rel.startsWith("..") || path.isAbsolute(rel)) problems.push(`不得 import core 以外的模块："${spec}"`)
  }

  // 去掉类型与注释，只看会运行的代码。
  const code = transpiler.transformSync(source)
  for (const [, name] of code.matchAll(MATH_RE)) problems.push(`禁止 Math.${name}，改用 core/math.ts 或 core/rng.ts`)

  const bare = stripStrings(code)
  if (POW_RE.test(bare)) problems.push("禁止 ** 运算符，改用 core/math.ts")
  POW_RE.lastIndex = 0
  for (const [, name] of bare.matchAll(GLOBALS_RE)) problems.push(`禁止使用全局 ${name}`)
  for (const [, name] of bare.matchAll(LOCALE_RE)) problems.push(`禁止 ${name}，结果依赖运行环境的 locale`)

  return [...new Set(problems)]
}

/** 检查一个 Game 的 src/core/，返回带文件路径的错误列表。没有 src/core/ 时返回空。 */
export async function checkCore(gameDir: string, label = path.basename(gameDir)): Promise<string[]> {
  const coreDir = path.join(gameDir, "src/core")
  const errors: string[] = []
  const files = new Glob("**/*.ts").scan({ cwd: coreDir, onlyFiles: true, throwErrorOnBrokenSymlink: false })
  try {
    for await (const rel of files) {
      if (rel.endsWith(".test.ts") || rel.startsWith("fixtures/")) continue
      const file = path.join(coreDir, rel)
      const problems = checkCoreSource(await Bun.file(file).text(), file, coreDir)
      for (const p of problems) errors.push(`${label}: src/core/${rel}: ${p}`)
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
  return errors
}
