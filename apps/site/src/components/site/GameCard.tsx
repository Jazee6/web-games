import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Props {
  name: string
  description: string
  href: string
  cover: { src: string; width: number; height: number }
  /** 首屏的卡片立即加载，避免拖慢 LCP。 */
  eager?: boolean
}

/** 静态渲染，不水合。整张卡片是一个链接。 */
export function GameCard({ name, description, href, cover, eager = false }: Props) {
  return (
    <a href={href} className="rounded-4xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <Card size="sm" className="h-full transition-shadow hover:shadow-lg">
        <img
          src={cover.src}
          width={cover.width}
          height={cover.height}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="aspect-video w-full object-cover"
        />
        <CardHeader>
          <CardTitle>{name}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
      </Card>
    </a>
  )
}
