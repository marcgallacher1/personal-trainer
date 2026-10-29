import { describe, expect, it } from 'vitest'
import { detectPlatform, type PlatformSignals } from './platform'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const CHROME_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const base: PlatformSignals = {
  userAgent: IPHONE_SAFARI,
  maxTouchPoints: 5,
  navigatorStandalone: false,
  displayModeStandalone: false,
}

describe('detectPlatform', () => {
  it('asks iPhone Safari users to install', () => {
    expect(detectPlatform(base)).toEqual({
      isIOS: true,
      isStandalone: false,
      needsInstall: true,
      iosVersion: 18.05,
    })
  })

  it('treats the home-screen app as installed via navigator.standalone', () => {
    const p = detectPlatform({ ...base, navigatorStandalone: true })
    expect(p.isStandalone).toBe(true)
    expect(p.needsInstall).toBe(false)
  })

  it('treats display-mode: standalone as installed', () => {
    expect(detectPlatform({ ...base, displayModeStandalone: true }).needsInstall).toBe(false)
  })

  it('detects iPadOS masquerading as a Mac', () => {
    const p = detectPlatform({ ...base, userAgent: IPAD_DESKTOP_UA })
    expect(p.isIOS).toBe(true)
    expect(p.iosVersion).toBe(17.04)
  })

  it('does not block desktop browsers', () => {
    const p = detectPlatform({ ...base, userAgent: CHROME_WIN, maxTouchPoints: 0 })
    expect(p).toMatchObject({ isIOS: false, needsInstall: false, iosVersion: null })
  })
})
