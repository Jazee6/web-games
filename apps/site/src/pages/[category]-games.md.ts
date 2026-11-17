import type { APIRoute, GetStaticPaths } from "astro"
import { categoryMarkdown, markdownResponse } from "@/lib/markdown"
import { type Category, categories } from "@/lib/site"

export const getStaticPaths = (() =>
  categories.map((category) => ({
    params: { category: category.id },
    props: { category },
  }))) satisfies GetStaticPaths

export const GET: APIRoute<{ category: Category }> = ({ props }) => markdownResponse(categoryMarkdown(props.category))
