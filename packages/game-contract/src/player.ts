import {
  AD_NOT_SHOWN,
  CONTRACT_VERSION,
  envelope,
  type AdKind,
  type AdResult,
  type Envelope,
  type GameNotifications,
  type GameRequests,
  type InitPayload,
  type JsonValue,
  type Port,
} from "./protocol"

/** Save 的实际存储。首发写浏览器本地，将来换成云存档只替换这个实现。 */
export interface SaveStore {
  get(key: string): Promise<JsonValue | null>
  set(key: string, value: JsonValue): Promise<void>
  remove(key: string): Promise<void>
}

/** 每个 Game 一个本地存储条目，值是 key → JSON 的对象。 */
export function createLocalSaveStore(storage: Storage, slug: string): SaveStore {
  const storageKey = `web-games:save:${slug}`
  const read = (): Record<string, JsonValue> => {
    try {
      const parsed = JSON.parse(storage.getItem(storageKey) ?? "{}")
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
    } catch {
      return {}
    }
  }
  return {
    async get(key) {
      return read()[key] ?? null
    },
    async set(key, value) {
      const data = read()
      data[key] = value
      storage.setItem(storageKey, JSON.stringify(data))
    },
    async remove(key) {
      const data = read()
      delete data[key]
      storage.setItem(storageKey, JSON.stringify(data))
    },
  }
}

export interface PlayerHostOptions {
  port: Port
  locale: string
  save: SaveStore
  muted?: boolean
  paused?: boolean
  fullscreen?: { available: boolean; active: boolean }
  onProgress?(value: number): void
  onReady?(): void
  /** Game 请求切换静音。Player 决定后调用 host.setMuted 回传最终状态。 */
  onMuteRequest?(muted: boolean): void
  /** Game 请求切换全屏。Player 决定后调用 host.setFullscreen 回传最终状态。 */
  onFullscreenRequest?(active: boolean): void
  /** 首发为空实现：不传则立即返回“未展示”。 */
  requestAd?(kind: AdKind): Promise<AdResult>
  /** 首发为空实现：不传则丢弃。 */
  onEvent?(name: string, data?: { [key: string]: JsonValue }): void
}

export interface PlayerHost {
  /** Game 是否已完成握手。 */
  readonly connected: boolean
  pause(): void
  resume(): void
  setMuted(muted: boolean): void
  setFullscreen(active: boolean): void
  dispose(): void
}

export function createPlayerHost(options: PlayerHostOptions): PlayerHost {
  const { port } = options
  const state = {
    connected: false,
    muted: options.muted ?? false,
    paused: options.paused ?? false,
    fullscreen: { ...(options.fullscreen ?? { available: false, active: false }) },
  }

  const send = (type: string, payload?: unknown) => {
    if (state.connected) port.post(envelope(type, payload))
  }
  const respond = (id: number, result: unknown) =>
    port.post(envelope("response", { result: result ?? null }, id))
  const fail = (id: number, error: unknown) =>
    port.post(
      envelope("response", { error: error instanceof Error ? error.message : String(error) }, id),
    )

  const handleRequest = async (message: Envelope & { id: number }): Promise<unknown> => {
    switch (message.type) {
      case "hello": {
        state.connected = true
        const init: InitPayload = {
          contractVersion: CONTRACT_VERSION,
          locale: options.locale,
          muted: state.muted,
          paused: state.paused,
          fullscreen: { ...state.fullscreen },
        }
        return init
      }
      case "save.get": {
        const { key } = message.payload as GameRequests["save.get"]["payload"]
        return options.save.get(requireKey(key))
      }
      case "save.set": {
        const { key, value } = message.payload as GameRequests["save.set"]["payload"]
        await options.save.set(requireKey(key), toJson(value))
        return null
      }
      case "save.remove": {
        const { key } = message.payload as GameRequests["save.remove"]["payload"]
        await options.save.remove(requireKey(key))
        return null
      }
      case "ad.request": {
        const { kind } = message.payload as GameRequests["ad.request"]["payload"]
        if (!options.requestAd) return AD_NOT_SHOWN
        try {
          return await options.requestAd(kind)
        } catch {
          return AD_NOT_SHOWN
        }
      }
      default:
        throw new Error(`unsupported: ${message.type}`)
    }
  }

  const handleNotification = (message: Envelope) => {
    switch (message.type) {
      case "progress": {
        const { value } = (message.payload ?? {}) as GameNotifications["progress"]
        if (typeof value === "number") options.onProgress?.(value)
        break
      }
      case "ready":
        options.onReady?.()
        break
      case "event": {
        const { name, data } = (message.payload ?? {}) as GameNotifications["event"]
        if (typeof name === "string") options.onEvent?.(name, data)
        break
      }
      case "mute.set": {
        const { muted } = (message.payload ?? {}) as GameNotifications["mute.set"]
        options.onMuteRequest?.(Boolean(muted))
        break
      }
      case "fullscreen.set": {
        const { active } = (message.payload ?? {}) as GameNotifications["fullscreen.set"]
        options.onFullscreenRequest?.(Boolean(active))
        break
      }
    }
  }

  const unlisten = port.listen((message) => {
    if (message.id !== undefined) {
      const id = message.id
      handleRequest(message as Envelope & { id: number }).then(
        (result) => respond(id, result),
        (error) => fail(id, error),
      )
    } else {
      handleNotification(message)
    }
  })

  return {
    get connected() {
      return state.connected
    },
    pause() {
      if (state.paused) return
      state.paused = true
      send("pause")
    },
    resume() {
      if (!state.paused) return
      state.paused = false
      send("resume")
    },
    setMuted(muted) {
      state.muted = muted
      send("mute", { muted })
    },
    setFullscreen(active) {
      state.fullscreen.active = active
      send("fullscreen", { active })
    },
    dispose() {
      unlisten()
      state.connected = false
    },
  }
}

function requireKey(key: unknown): string {
  if (typeof key !== "string" || key.length === 0) throw new Error("invalid save key")
  return key
}

function toJson(value: unknown): JsonValue {
  if (value === undefined) throw new Error("save value must be JSON-serializable")
  return JSON.parse(JSON.stringify(value))
}
