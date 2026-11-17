import type { ImageMetadata } from "astro"
import { getImage } from "astro:assets"
import defaultOg from "@/assets/og.svg"
import { absoluteUrl } from "./site"

/** Open Graph 图：统一转成 1200×630 的 PNG（社交平台不认 SVG），返回绝对地址。 */
export async function ogImage(src: ImageMetadata = defaultOg): Promise<string> {
  const image = await getImage({ src, format: "png", width: 1200, height: 630, fit: "cover" })
  return absoluteUrl(image.src)
}
