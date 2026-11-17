import type { APIRoute, GetStaticPaths } from "astro"
import { markdownResponse, pageMarkdown } from "@/lib/markdown"
import { type Page, pages } from "@/lib/site"

export const getStaticPaths = (() =>
  pages.map((page) => ({ params: { page: page.slug }, props: { page } }))) satisfies GetStaticPaths

export const GET: APIRoute<{ page: Page }> = ({ props }) => markdownResponse(pageMarkdown(props.page))
