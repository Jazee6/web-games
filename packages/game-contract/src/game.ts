import {
  AD_NOT_SHOWN,
  CONTRACT_VERSION,
  createWindowPort,
  envelope,
  type AdKind,
  type AdResult,
  type Envelope,
  type GameNotifications,
  type GameRequests,
  type InitPayload,
  type JsonValue,
  type PlayerNotifications,
  type Port,
  type ResponsePayload,
} from "./protocol"

export type GameEvent = keyof PlayerNotifications

export interface GameSession {
  /** Player 实现的 Game Contract 版本；独立运行时为 0。 */
  readonly contractVersion: number
  /** 是否运行在 Player 中。直接打开 /play/<slug>/ 时为 false，Save 只保存在内存里。 */
  readonly embedded: boolean
  readonly locale: string
  readonly muted: boolean
  readonly paused: boolean
  readonly fullscreen: { readonly available: boolean; readonly active: boolean }

  /** 加载进度，0–1。 */
  setProgress(value: number): void
  /** 可以开始玩了。 */
  ready(): void

  save: {
    get<T extends JsonValue = JsonValue>(key: string): Promise<T | null>
    set(key: string, value: JsonValue): Promise<void>
    remove(key: string): Promise<void>
  }

  /** 请求广告。永不 reject：未展示、超时、出错都返回 { shown: false }。 */
  requestAd(kind: AdKind): Promise<AdResult>
  /** 上报事件，不等待结果。 */
  track(name: string, data?: { [key: string]: JsonValue }): void

  setMuted(muted: boolean): void
  setFullscreen(active: boolean): void

  /** 订阅 Player 的通知，返回取消订阅函数。状态字段在回调之前已更新。 */
  on<E extends GameEvent>(event: E, handler: (payload: PlayerNotifications[E]) => void): () => void
}

export interface ConnectOptions {
  /** 默认是 window 与 window.parent 之间的 postMessage 通道。 */
  port?: Port
  /** 握手超时，超时后按独立运行处理。 */
  helloTimeoutMs?: number
  /** 其他请求的超时。 */
  requestTimeoutMs?: number
  /** 独立运行时使用的 Locale。 */
  fallbackLocale?: string
}

type Handler = (payload: never) => void

/**
 * 连接 Player。Game 启动时调用一次，拿到 Locale、静音等初始状态后再渲染。
 */
export async function connect(options: ConnectOptions = {}): Promise<GameSession> {
  const port = options.port ?? defaultPort()
  const fallbackLocale = options.fallbackLocale ?? "en"
  if (!port) return createStandaloneSession(fallbackLocale)

  const client = createRequestClient(port, options.requestTimeoutMs ?? 10_000)
  let init: InitPayload
  try {
    init = await client.request<"hello">(
      "hello",
      { contractVersion: CONTRACT_VERSION },
      options.helloTimeoutMs ?? 3_000,
    )
  } catch {
    client.dispose()
    return createStandaloneSession(fallbackLocale)
  }

  const state = {
    muted: init.muted,
    paused: init.paused,
    fullscreen: { ...init.fullscreen },
  }
  const emitter = createEmitter()

  client.onNotification((message) => {
    switch (message.type) {
      case "pause":
        state.paused = true
        break
      case "resume":
        state.paused = false
        break
      case "mute":
        state.muted = Boolean((message.payload as PlayerNotifications["mute"])?.muted)
        break
      case "fullscreen":
        state.fullscreen.active = Boolean(
          (message.payload as PlayerNotifications["fullscreen"])?.active,
        )
        break
      default:
        return
    }
    emitter.emit(message.type as GameEvent, message.payload)
  })

  const notify = <T extends keyof GameNotifications>(type: T, payload: GameNotifications[T]) =>
    port.post(envelope(type, payload))

  return {
    contractVersion: init.contractVersion,
    embedded: true,
    locale: init.locale,
    get muted() {
      return state.muted
    },
    get paused() {
      return state.paused
    },
    get fullscreen() {
      return state.fullscreen
    },
    setProgress(value) {
      notify("progress", { value: clamp01(value) })
    },
    ready() {
      notify("ready", undefined)
    },
    save: {
      get: (key) => client.request("save.get", { key }) as never,
      set: (key, value) => client.request("save.set", { key, value }).then(() => undefined),
      remove: (key) => client.request("save.remove", { key }).then(() => undefined),
    },
    requestAd(kind) {
      return client
        .request("ad.request", { kind })
        .then((result) => normalizeAdResult(result))
        .catch(() => AD_NOT_SHOWN)
    },
    track(name, data) {
      notify("event", data === undefined ? { name } : { name, data })
    },
    setMuted(muted) {
      notify("mute.set", { muted })
    },
    setFullscreen(active) {
      notify("fullscreen.set", { active })
    },
    on: emitter.on,
  }
}

function defaultPort(): Port | null {
  if (typeof window === "undefined" || window.parent === window) return null
  return createWindowPort(window, () => window.parent)
}

function createRequestClient(port: Port, defaultTimeoutMs: number) {
  let nextId = 1
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
  >()
  let notificationHandler: (message: Envelope) => void = () => {}

  const unlisten = port.listen((message) => {
    if (message.type === "response" && message.id !== undefined) {
      const entry = pending.get(message.id)
      if (!entry) return
      pending.delete(message.id)
      clearTimeout(entry.timer)
      const payload = (message.payload ?? {}) as ResponsePayload
      if (payload.error) entry.reject(new Error(payload.error))
      else entry.resolve(payload.result ?? null)
      return
    }
    notificationHandler(message)
  })

  return {
    request<T extends keyof GameRequests>(
      type: T,
      payload: GameRequests[T]["payload"],
      timeoutMs = defaultTimeoutMs,
    ): Promise<GameRequests[T]["result"]> {
      const id = nextId++
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(new Error(`Game Contract request "${type}" timed out`))
        }, timeoutMs)
        pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer })
        port.post(envelope(type, payload, id))
      })
    },
    onNotification(handler: (message: Envelope) => void) {
      notificationHandler = handler
    },
    dispose() {
      unlisten()
      for (const entry of pending.values()) clearTimeout(entry.timer)
      pending.clear()
    },
  }
}

/** 没有 Player 时的会话：Save 只在内存里，广告不展示，其余请求为空操作。 */
function createStandaloneSession(locale: string): GameSession {
  const memory = new Map<string, JsonValue>()
  const state = { muted: false, paused: false, fullscreen: { available: false, active: false } }
  const emitter = createEmitter()
  return {
    contractVersion: 0,
    embedded: false,
    locale,
    get muted() {
      return state.muted
    },
    get paused() {
      return state.paused
    },
    get fullscreen() {
      return state.fullscreen
    },
    setProgress() {},
    ready() {},
    save: {
      get: async (key) => (memory.has(key) ? structuredClone(memory.get(key)!) : null) as never,
      set: async (key, value) => void memory.set(key, structuredClone(value)),
      remove: async (key) => void memory.delete(key),
    },
    requestAd: async () => AD_NOT_SHOWN,
    track() {},
    setMuted(muted) {
      if (state.muted === muted) return
      state.muted = muted
      emitter.emit("mute", { muted })
    },
    setFullscreen() {},
    on: emitter.on,
  }
}

function createEmitter() {
  const handlers = new Map<GameEvent, Set<Handler>>()
  return {
    on<E extends GameEvent>(event: E, handler: (payload: PlayerNotifications[E]) => void) {
      let set = handlers.get(event)
      if (!set) handlers.set(event, (set = new Set()))
      set.add(handler as Handler)
      return () => {
        set.delete(handler as Handler)
      }
    },
    emit(event: GameEvent, payload: unknown) {
      for (const handler of handlers.get(event) ?? []) handler(payload as never)
    },
  }
}

function normalizeAdResult(value: unknown): AdResult {
  const result = (value ?? {}) as Partial<AdResult>
  const shown = result.shown === true
  return { shown, rewarded: shown && result.rewarded === true }
}

function clamp01(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
}
