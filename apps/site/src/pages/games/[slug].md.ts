import type { APIRoute, GetStaticPaths } from "astro"
import { gameMarkdown, markdownResponse } from "@/lib/markdown"
import { type Game, games } from "@/lib/site"

export const getStaticPaths = (() =>
  games.map((game) => ({ params: { slug: game.slug }, props: { game } }))) satisfies GetStaticPaths

export const GET: APIRoute<{ game: Game }> = ({ props }) => markdownResponse(gameMarkdown(props.game))
