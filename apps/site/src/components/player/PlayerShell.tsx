import { useEffect, useRef, useState } from "react"
import { MaximizeIcon, MinimizeIcon, Volume2Icon, VolumeXIcon } from "lucide-react"
import { createWindowPort } from "@web-games/game-contract"
import { createLocalSaveStore, createPlayerHost, type PlayerHost } from "@web-games/game-contract/player"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

type FullscreenMode = "off" | "native" | "pseudo"

const MUTED_KEY = "web-games:muted"

interface PlayerShellProps {
  root: HTMLElement
  slug: string
  name: string
  locale: string
  onReady(): void
}

export function PlayerShell({ root, slug, name, locale, onReady }: PlayerShellProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const hostRef = useRef<PlayerHost | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [ready, setReady] = useState(false)
  const [muted, setMuted] = useState(() => readMuted())
  const [fullscreen, setFullscreen] = useState<FullscreenMode>("off")

  const nativeFullscreen = document.fullscreenEnabled && typeof root.requestFullscreen === "function"

  async function changeFullscreen(active: boolean) {
    if (active) {
      if (nativeFullscreen) {
        try {
          await root.requestFullscreen({ navigationUI: "hide" })
          return
        } catch {
          // 没有用户手势或浏览器拒绝时退回伪全屏。
        }
      }
      // iPhone Safari 不支持对普通元素全屏，用铺满视口代替。
      setFullscreen("pseudo")
    } else {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {})
      setFullscreen("off")
    }
  }

  // 用 ref 让 Game Contract 回调始终调用最新的处理函数，host 只创建一次。
  const changeFullscreenRef = useRef(changeFullscreen)
  changeFullscreenRef.current = changeFullscreen

  useEffect(() => {
    const iframe = iframeRef.current!
    const host = createPlayerHost({
      port: createWindowPort(window, () => iframe.contentWindow),
      locale,
      save: createLocalSaveStore(window.localStorage, slug),
      muted: readMuted(),
      paused: document.hidden,
      fullscreen: { available: true, active: false },
      onProgress: setProgress,
      onReady: () => {
        setReady(true)
        onReady()
      },
      onMuteRequest: setMuted,
      onFullscreenRequest: (active) => changeFullscreenRef.current(active),
    })
    hostRef.current = host
    // host 就绪后再加载 Game Bundle，确保收得到握手消息。
    iframe.src = `/play/${slug}/`

    const onVisibility = () => (document.hidden ? host.pause() : host.resume())
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      document.removeEventListener("visibilitychange", onVisibility)
      host.dispose()
      hostRef.current = null
    }
  }, [slug, locale])

  useEffect(() => {
    hostRef.current?.setMuted(muted)
    try {
      window.localStorage.setItem(MUTED_KEY, muted ? "1" : "0")
    } catch {
      // 存储不可用时只在本次会话内生效。
    }
  }, [muted])

  useEffect(() => {
    const onChange = () =>
      setFullscreen((mode) => (document.fullscreenElement === root ? "native" : mode === "native" ? "off" : mode))
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [root])

  useEffect(() => {
    if (fullscreen === "off") delete root.dataset.fullscreen
    else root.dataset.fullscreen = fullscreen
    hostRef.current?.setFullscreen(fullscreen !== "off")
    if (fullscreen !== "pseudo") return
    const overflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = "hidden"
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setFullscreen("off")
    document.addEventListener("keydown", onKey)
    return () => {
      document.documentElement.style.overflow = overflow
      document.removeEventListener("keydown", onKey)
    }
  }, [fullscreen, root])

  const isFullscreen = fullscreen !== "off"

  return (
    <>
      <div className="relative min-h-0 flex-1 bg-background">
        <iframe
          ref={iframeRef}
          title={name}
          allow="fullscreen; autoplay"
          className="absolute inset-0 size-full border-0"
        />
      </div>
      <div className="flex items-center justify-end gap-1 border-t bg-background p-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={muted}
          onClick={() => setMuted(!muted)}
        >
          {muted ? <VolumeXIcon /> : <Volume2Icon />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          aria-pressed={isFullscreen}
          onClick={() => changeFullscreen(!isFullscreen)}
        >
          {isFullscreen ? <MinimizeIcon /> : <MaximizeIcon />}
        </Button>
      </div>
      {!ready && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 p-8">
          <Progress
            value={progress === null ? null : Math.round(progress * 100)}
            aria-label="Loading"
            className="w-full max-w-xs"
          />
        </div>
      )}
    </>
  )
}

function readMuted() {
  try {
    return window.localStorage.getItem(MUTED_KEY) === "1"
  } catch {
    return false
  }
}
