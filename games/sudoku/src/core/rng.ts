/**
 * 种子随机数（ADR-0004）：sfc32，只用 32 位整数运算，各引擎结果一致，状态可序列化。
 */

export type RngState = readonly [number, number, number, number]

export interface Rng {
  /** 下一个 32 位无符号整数。 */
  next(): number
  /** [0, n) 内的整数，n ≤ 2^32。 */
  int(n: number): number
  /** 原地 Fisher–Yates 洗牌。 */
  shuffle<T>(items: T[]): T[]
  state(): RngState
}

/** 把字符串散列为 128 位（4 × 32 位）状态。 */
export function hashToState(text: string): RngState {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < text.length; i++) {
    const k = text.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

/** 字符串的 64 位散列，16 位十六进制。用于状态哈希与 Daily Puzzle 种子。 */
export function hashHex(text: string): string {
  const [a, b] = hashToState(text)
  return hex8(a) + hex8(b)
}

function hex8(n: number) {
  return (n >>> 0).toString(16).padStart(8, "0")
}

export function createRng(seed: string | RngState): Rng {
  let [a, b, c, d] = typeof seed === "string" ? hashToState(seed) : seed
  const next = () => {
    a >>>= 0
    b >>>= 0
    c >>>= 0
    d >>>= 0
    const t = (a + b) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    d = (d + 1) | 0
    const r = (t + d) | 0
    c = (c + r) | 0
    return r >>> 0
  }
  // 丢弃前几个输出，让相近的种子充分分散。
  for (let i = 0; i < 12; i++) next()

  const int = (n: number) => Math.floor((next() / 4294967296) * n)
  return {
    next,
    int,
    shuffle(items) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = int(i + 1)
        const tmp = items[i]!
        items[i] = items[j]!
        items[j] = tmp
      }
      return items
    },
    state: () => [a >>> 0, b >>> 0, c >>> 0, d >>> 0],
  }
}
