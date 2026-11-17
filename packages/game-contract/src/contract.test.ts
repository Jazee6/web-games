import { describe, expect, test } from "bun:test"
import { connect } from "./game"
import { createLocalSaveStore, createPlayerHost, type PlayerHostOptions } from "./player"
import { CONTRACT_VERSION, envelope, type Envelope, type Port } from "./protocol"

/** 一对内存通道，异步投递，模拟 postMessage。 */
function createPortPair(): [Port, Port] {
  const listeners: [Set<(m: Envelope) => void>, Set<(m: Envelope) => void>] = [new Set(), new Set()]
  const make = (self: 0 | 1): Port => ({
    post(message) {
      const copy = structuredClone(message)
      queueMicrotask(() => listeners[self === 0 ? 1 : 0].forEach((h) => h(copy)))
    },
    listen(handler) {
      listeners[self].add(handler)
      return () => listeners[self].delete(handler)
    },
  })
  return [make(0), make(1)]
}

function createMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  }
}

function setup(overrides: Partial<PlayerHostOptions> = {}) {
  const [playerPort, gamePort] = createPortPair()
  const storage = createMemoryStorage()
  const calls = { progress: [] as number[], ready: 0, mute: [] as boolean[], fullscreen: [] as boolean[], events: [] as string[] }
  const host = createPlayerHost({
    port: playerPort,
    locale: "en",
    save: createLocalSaveStore(storage, "test"),
    fullscreen: { available: true, active: false },
    onProgress: (v) => calls.progress.push(v),
    onReady: () => calls.ready++,
    onMuteRequest: (m) => calls.mute.push(m),
    onFullscreenRequest: (a) => calls.fullscreen.push(a),
    onEvent: (name) => calls.events.push(name),
    ...overrides,
  })
  return { host, gamePort, playerPort, storage, calls }
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe("handshake", () => {
  test("Game 拿到 Player 的初始状态", async () => {
    const { gamePort, host } = setup({ locale: "en", muted: true })
    host.pause()
    const session = await connect({ port: gamePort })
    expect(session.embedded).toBe(true)
    expect(session.contractVersion).toBe(CONTRACT_VERSION)
    expect(session.locale).toBe("en")
    expect(session.muted).toBe(true)
    expect(session.paused).toBe(true)
    expect(session.fullscreen).toEqual({ available: true, active: false })
    expect(host.connected).toBe(true)
  })

  test("没有 Player 时按独立运行处理", async () => {
    const [, lonely] = createPortPair()
    const session = await connect({ port: lonely, helloTimeoutMs: 10, fallbackLocale: "en" })
    expect(session.embedded).toBe(false)
    await session.save.set("k", { a: 1 })
    expect(await session.save.get("k")).toEqual({ a: 1 })
    expect(await session.requestAd("rewarded")).toEqual({ shown: false, rewarded: false })
  })
})

describe("progress / ready / events", () => {
  test("进度被限制在 0–1，ready 与事件到达 Player", async () => {
    const { gamePort, calls } = setup()
    const session = await connect({ port: gamePort })
    session.setProgress(0.5)
    session.setProgress(2)
    session.ready()
    session.track("start", { level: 1 })
    await tick()
    expect(calls.progress).toEqual([0.5, 1])
    expect(calls.ready).toBe(1)
    expect(calls.events).toEqual(["start"])
  })
})

describe("pause / mute / fullscreen", () => {
  test("Player 的通知更新 Game 状态并触发回调", async () => {
    const { gamePort, host } = setup()
    const session = await connect({ port: gamePort })
    const seen: string[] = []
    session.on("pause", () => seen.push("pause"))
    session.on("resume", () => seen.push("resume"))
    session.on("mute", ({ muted }) => seen.push(`mute:${muted}`))
    session.on("fullscreen", ({ active }) => seen.push(`fs:${active}`))
    host.pause()
    host.pause() // 重复调用不重复通知
    await tick()
    expect(session.paused).toBe(true)
    host.resume()
    host.setMuted(true)
    host.setFullscreen(true)
    await tick()
    expect(seen).toEqual(["pause", "resume", "mute:true", "fs:true"])
    expect(session.muted).toBe(true)
    expect(session.fullscreen.active).toBe(true)
  })

  test("Game 发起的静音、全屏请求交给 Player 决定", async () => {
    const { gamePort, calls } = setup()
    const session = await connect({ port: gamePort })
    session.setMuted(true)
    session.setFullscreen(true)
    await tick()
    expect(calls.mute).toEqual([true])
    expect(calls.fullscreen).toEqual([true])
    // Player 回传前状态不变
    expect(session.muted).toBe(false)
  })
})

describe("Save", () => {
  test("读写删经 Player 存进本地存储，按 slug 隔离", async () => {
    const { gamePort, storage } = setup()
    const session = await connect({ port: gamePort })
    expect(await session.save.get("best")).toBeNull()
    await session.save.set("best", { time: 42 })
    expect(await session.save.get<{ time: number }>("best")).toEqual({ time: 42 })
    expect(JSON.parse(storage.getItem("web-games:save:test")!)).toEqual({ best: { time: 42 } })
    await session.save.remove("best")
    expect(await session.save.get("best")).toBeNull()
  })

  test("本地数据损坏时当作空", async () => {
    const storage = createMemoryStorage()
    storage.setItem("web-games:save:x", "{broken")
    const store = createLocalSaveStore(storage, "x")
    expect(await store.get("a")).toBeNull()
  })

  test("存储失败时 Game 收到 reject", async () => {
    const { gamePort } = setup({
      save: {
        get: async () => null,
        set: async () => {
          throw new Error("quota")
        },
        remove: async () => {},
      },
    })
    const session = await connect({ port: gamePort })
    await expect(session.save.set("k", 1)).rejects.toThrow("quota")
  })

  test("非法 key 被拒绝", async () => {
    const { gamePort } = setup()
    const session = await connect({ port: gamePort })
    await expect(session.save.get("")).rejects.toThrow("invalid save key")
  })
})

describe("广告", () => {
  test("首发空实现：立即返回未展示", async () => {
    const { gamePort } = setup()
    const session = await connect({ port: gamePort })
    expect(await session.requestAd("interstitial")).toEqual({ shown: false, rewarded: false })
  })

  test("Player 一侧出错或超时也返回未展示", async () => {
    const { gamePort } = setup({ requestAd: () => new Promise(() => {}) })
    const session = await connect({ port: gamePort, requestTimeoutMs: 10 })
    expect(await session.requestAd("rewarded")).toEqual({ shown: false, rewarded: false })
  })

  test("将来实现广告时只改 Player 一侧", async () => {
    const { gamePort } = setup({ requestAd: async () => ({ shown: true, rewarded: true }) })
    const session = await connect({ port: gamePort })
    expect(await session.requestAd("rewarded")).toEqual({ shown: true, rewarded: true })
  })
})

describe("向后兼容", () => {
  test("Player 对未知请求回复 unsupported，忽略未知通知", async () => {
    const { gamePort } = setup()
    const replies: Envelope[] = []
    gamePort.listen((m) => replies.push(m))
    gamePort.post(envelope("future.request", {}, 99))
    gamePort.post(envelope("future.notification", {}))
    await tick()
    expect(replies).toHaveLength(1)
    expect(replies[0]).toMatchObject({ type: "response", id: 99, payload: { error: "unsupported: future.request" } })
  })

  test("Game 忽略未知通知", async () => {
    const { gamePort, playerPort } = setup()
    const session = await connect({ port: gamePort })
    playerPort.post(envelope("future.notification", { x: 1 }))
    await tick()
    expect(session.paused).toBe(false)
  })
})
