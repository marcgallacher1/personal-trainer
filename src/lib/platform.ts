/** Inputs captured from the browser so the logic stays pure and testable. */
export interface PlatformSignals {
  userAgent: string
  /** `navigator.maxTouchPoints` — iPadOS reports a Mac UA but has touch. */
  maxTouchPoints: number
  /** iOS Safari's non-standard `navigator.standalone`. */
  navigatorStandalone: boolean | undefined
  /** `matchMedia('(display-mode: standalone)').matches` */
  displayModeStandalone: boolean
}

export interface PlatformInfo {
  isIOS: boolean
  isStandalone: boolean
  /** True when we should block on the "Add to Home Screen" screen (iOS, in a browser tab). */
  needsInstall: boolean
  /** Web Push on iOS requires 16.4+ *and* a home-screen install. */
  iosVersion: number | null
}

export function detectPlatform(s: PlatformSignals): PlatformInfo {
  const ua = s.userAgent
  const isIPhoneOrIPod = /iPhone|iPod/.test(ua)
  const isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && s.maxTouchPoints > 1)
  const isIOS = isIPhoneOrIPod || isIPad
  const isStandalone = s.navigatorStandalone === true || s.displayModeStandalone

  const m = /OS (\d+)[_.](\d+)/.exec(ua) ?? /Version\/(\d+)\.(\d+)/.exec(ua)
  const iosVersion = isIOS && m ? Number(m[1]) + Number(m[2]) / 100 : null

  return { isIOS, isStandalone, needsInstall: isIOS && !isStandalone, iosVersion }
}

/** Reads signals from the live browser. Not unit-tested; keep it trivial. */
export function readPlatformSignals(): PlatformSignals {
  const nav = navigator as Navigator & { standalone?: boolean }
  return {
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints,
    navigatorStandalone: nav.standalone,
    displayModeStandalone: window.matchMedia('(display-mode: standalone)').matches,
  }
}
