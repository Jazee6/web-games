/**
 * 确定性数学（ADR-0004）。数独只用整数与位运算，不需要超越函数；
 * 这里集中放候选数位掩码的工具。位 d−1 表示数字 d。
 */

export const ALL_DIGITS = 0b111111111

export function bit(digit: number): number {
  return 1 << (digit - 1)
}

export function popcount(mask: number): number {
  let n = mask - ((mask >>> 1) & 0x55555555)
  n = (n & 0x33333333) + ((n >>> 2) & 0x33333333)
  return (Math.imul((n + (n >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24) & 0xff
}

/** 掩码中最小的数字（1–9），掩码为 0 时返回 0。 */
export function lowestDigit(mask: number): number {
  return mask === 0 ? 0 : 32 - Math.clz32(mask & -mask)
}

/** 掩码包含的数字，从小到大。 */
export function digitsOf(mask: number): number[] {
  const digits: number[] = []
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) digits.push(d)
  return digits
}
