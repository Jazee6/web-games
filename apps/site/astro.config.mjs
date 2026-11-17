// @ts-check

import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"
import react from "@astrojs/react"

// 纯静态输出，不引入 Cloudflare 适配器（ADR-0001）。
export default defineConfig({
  // 正式域名暂定。
  site: "https://games.jaze.top",
  output: "static",
  trailingSlash: "always",
  // 封面是仓库内自绘的可信 SVG，需要栅格化成 PNG（Open Graph）和 WebP（卡片）。
  image: {
    dangerouslyProcessSVG: true,
  },
  build: {
    format: "directory",
  },
  vite: {
    plugins: [tailwindcss()],
  },
  integrations: [react()],
})
