import type { APIRoute, GetStaticPaths } from "astro"
import { guideMarkdown, markdownResponse } from "@/lib/markdown"
import { type Guide, guides } from "@/lib/site"

export const getStaticPaths = (() =>
  guides.map((guide) => ({
    params: { slug: guide.slug },
    props: { guide },
  }))) satisfies GetStaticPaths

export const GET: APIRoute<{ guide: Guide }> = ({ props }) => markdownResponse(guideMarkdown(props.guide))
