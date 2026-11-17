const messages = {
  en: {
    contract: "Contract",
    standalone: "standalone",
    locale: "Locale",
    timer: "Timer",
    paused: "paused",
    muted: "Muted",
    fullscreen: "Fullscreen",
    unavailable: "unavailable",
    save: "Save count",
    yes: "yes",
    no: "no",
    increment: "+1",
    reset: "Reset",
    toggleMute: "Mute",
    toggleFullscreen: "Fullscreen",
    interstitial: "Interstitial ad",
    rewarded: "Rewarded ad (+10)",
    saved: "Saved",
    cleared: "Save cleared",
    adShown: "Ad shown",
    adNotShown: "Ad not shown, continuing",
    "event.pause": "Paused by player",
    "event.resume": "Resumed by player",
    "event.mute": "Mute changed",
    "event.fullscreen": "Fullscreen changed",
  },
} as const

export type MessageKey = keyof (typeof messages)["en"]

/** 按传入的 Locale 取文案，没有对应语言时退回英文。 */
export function translate(locale: string) {
  const language = locale.split("-")[0] as keyof typeof messages
  const table = messages[language] ?? messages.en
  return (key: MessageKey) => table[key] ?? messages.en[key]
}
