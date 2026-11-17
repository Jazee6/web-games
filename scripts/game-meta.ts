/**
 * game.json 的字段定义与校验。纯 TypeScript，构建脚本（Bun）和站点（Astro）共用。
 */

export const TIERS = ["dom", "2d", "2.5d", "3d"] as const
export type Tier = (typeof TIERS)[number]

export const MAX_BUDGET_BYTES = 10 * 1024 * 1024

/** 各 Tier 的默认体积预算（docs/architecture/README.md 第 12 节）。2.5D / 3D 默认即上限，必须上报加载进度。 */
export const DEFAULT_BUDGET_BYTES: Record<Tier, number> = {
  dom: 2 * 1024 * 1024,
  "2d": 2 * 1024 * 1024,
  "2.5d": MAX_BUDGET_BYTES,
  "3d": MAX_BUDGET_BYTES,
}

export interface GameMeta {
  /** 上线后永不修改（ADR-0003），必须与目录名一致。 */
  slug: string
  /** Game 名称，各 Locale 共用。 */
  name: string
  /** content/categories/ 下的一个 Category。 */
  category: string
  /** 封面图文件名，相对 Game 目录，16:9。 */
  cover: string
  tier: Tier
  /** 草稿只在预览和本地构建中出现。 */
  draft?: boolean
  /** 体积预算例外，≤ 10 MB，且 Game 必须上报加载进度。 */
  budgetBytes?: number
  /** 手动指定的相关 Game，不足时由同 Category 自动补全。 */
  related?: string[]
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 校验单个 game.json，返回错误列表。dirName 是 Game 所在目录名。 */
export function validateGameMeta(meta: Partial<GameMeta>, dirName: string): string[] {
  const errors: string[] = []
  const prefix = `games/${dirName}/game.json`
  if (typeof meta.slug !== "string" || !SLUG.test(meta.slug))
    errors.push(`${prefix}: slug 只能由小写字母、数字和 - 组成`)
  else if (meta.slug !== dirName) errors.push(`${prefix}: slug "${meta.slug}" 必须与目录名一致`)
  if (typeof meta.name !== "string" || !meta.name.trim()) errors.push(`${prefix}: 缺少 name`)
  if (typeof meta.category !== "string" || !SLUG.test(meta.category)) errors.push(`${prefix}: 缺少 category`)
  if (typeof meta.cover !== "string" || !meta.cover) errors.push(`${prefix}: 缺少 cover`)
  if (!TIERS.includes(meta.tier as Tier)) errors.push(`${prefix}: tier 必须是 ${TIERS.join(" / ")} 之一`)
  if (meta.draft !== undefined && typeof meta.draft !== "boolean") errors.push(`${prefix}: draft 必须是布尔值`)
  if (meta.budgetBytes !== undefined) {
    if (typeof meta.budgetBytes !== "number" || meta.budgetBytes <= 0) errors.push(`${prefix}: budgetBytes 必须是正数`)
    else if (meta.budgetBytes > MAX_BUDGET_BYTES) errors.push(`${prefix}: budgetBytes 超过 10 MB 上限`)
  }
  if (
    meta.related !== undefined &&
    !(Array.isArray(meta.related) && meta.related.every((s) => typeof s === "string"))
  ) {
    errors.push(`${prefix}: related 必须是 slug 数组`)
  }
  return errors
}
