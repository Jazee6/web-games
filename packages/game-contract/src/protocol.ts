/**
 * Game Contract 消息协议。
 *
 * 兼容规则（ADR-0002，首发后只能做向后兼容的变更）：
 * - 只能新增消息类型和可选字段，不能删除或改变已有字段的含义。
 * - 双方收到不认识的 type 一律忽略；带 id 的未知请求由 Player 回复 unsupported 错误。
 * - CONTRACT_VERSION 只在新增能力时递增，用于能力判断，不用于拒绝连接。
 */

export const CONTRACT_NAMESPACE = "web-games/game-contract"
export const CONTRACT_VERSION = 1

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue }

export type AdKind = "interstitial" | "rewarded"

export interface AdResult {
  /** 广告是否实际展示。Game 必须能处理 false，不得因此阻塞流程。 */
  shown: boolean
  /** 激励广告是否发放奖励；插屏广告恒为 false。 */
  rewarded: boolean
}

export const AD_NOT_SHOWN: AdResult = Object.freeze({ shown: false, rewarded: false })

export interface InitPayload {
  contractVersion: number
  locale: string
  muted: boolean
  paused: boolean
  fullscreen: { available: boolean; active: boolean }
}

/** Game → Player 的请求，Player 必须用 response 回复同一个 id。 */
export interface GameRequests {
  hello: { payload: { contractVersion: number }; result: InitPayload }
  "save.get": { payload: { key: string }; result: JsonValue | null }
  "save.set": { payload: { key: string; value: JsonValue }; result: null }
  "save.remove": { payload: { key: string }; result: null }
  "ad.request": { payload: { kind: AdKind }; result: AdResult }
}

/** Game → Player 的通知，没有回复。 */
export interface GameNotifications {
  progress: { value: number }
  ready: undefined
  event: { name: string; data?: { [key: string]: JsonValue } }
  "mute.set": { muted: boolean }
  "fullscreen.set": { active: boolean }
}

/** Player → Game 的通知。 */
export interface PlayerNotifications {
  pause: undefined
  resume: undefined
  mute: { muted: boolean }
  fullscreen: { active: boolean }
}

export interface ResponsePayload {
  result?: unknown
  error?: string
}

export interface Envelope {
  ns: typeof CONTRACT_NAMESPACE
  v: number
  type: string
  id?: number
  payload?: unknown
}

export function envelope(type: string, payload?: unknown, id?: number): Envelope {
  const message: Envelope = { ns: CONTRACT_NAMESPACE, v: CONTRACT_VERSION, type }
  if (id !== undefined) message.id = id
  if (payload !== undefined) message.payload = payload
  return message
}

export function isEnvelope(value: unknown): value is Envelope {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Envelope).ns === CONTRACT_NAMESPACE &&
    typeof (value as Envelope).type === "string"
  )
}

/** 消息通道。浏览器里是 postMessage，测试里是内存实现。 */
export interface Port {
  post(message: Envelope): void
  listen(handler: (message: Envelope) => void): () => void
}

/**
 * 基于 window.postMessage 的通道，只接受来自 peer 且同源的消息。
 * Game 一侧 peer 是 window.parent，Player 一侧 peer 是 iframe.contentWindow。
 */
export function createWindowPort(self: Window, peer: () => Window | null): Port {
  const origin = self.location.origin
  return {
    post(message) {
      peer()?.postMessage(message, origin)
    },
    listen(handler) {
      const onMessage = (event: MessageEvent) => {
        if (event.origin !== origin || event.source !== peer()) return
        if (isEnvelope(event.data)) handler(event.data)
      }
      self.addEventListener("message", onMessage)
      return () => self.removeEventListener("message", onMessage)
    },
  }
}
