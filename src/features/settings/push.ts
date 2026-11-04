/** Turning on push notifications on this device, and keeping the server's copy up to date. */
import { supabase } from '../../db/supabase'
import { detectPlatform, readPlatformSignals } from '../../lib/platform'

/** Public half of the production VAPID key pair (safe to ship). VITE_VAPID_PUBLIC_KEY overrides it locally. */
const PROD_VAPID =
  'BJysx8KxjUBu85c0Axgn5-uA4DfhGq2K3Ti60PwxLQGWFIfJF9OALdU3ij9H1Q6somEVzRrHhxuj4G8dDXHpQRY'
const VAPID = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || PROD_VAPID

export type PushStatus =
  | 'unsupported'
  /** iPhone in Safari: needs installing to the Home Screen first */
  | 'needs-install'
  | 'not-configured'
  | 'denied'
  | 'off'
  | 'on'

export async function pushStatus(): Promise<PushStatus> {
  const platform = detectPlatform(readPlatformSignals())
  if (platform.isIOS && !platform.isStandalone) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
    return 'unsupported'
  if (!VAPID) return 'not-configured'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.ready
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off'
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const raw = atob((base64url + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function save(sub: PushSubscription): Promise<void> {
  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh ?? '',
      auth: json.keys?.auth ?? '',
      user_agent: navigator.userAgent,
      deleted_at: null,
    },
    { onConflict: 'endpoint' },
  )
  if (error) throw new Error(error.message)
}

/** Asks for permission (must be called from a tap) and subscribes this device. */
export async function enablePush(): Promise<void> {
  if (!VAPID) throw new Error('Push isn’t configured (VITE_VAPID_PUBLIC_KEY is missing).')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications weren’t allowed.')
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(VAPID),
    }))
  await save(sub)
}

/** Turns push off on this device. */
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase
    .from('push_subscriptions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}

/** On app start: re-send this device's subscription (they change or expire). */
export async function refreshPush(): Promise<void> {
  try {
    if ((await pushStatus()) === 'needs-install' || Notification.permission !== 'granted' || !VAPID)
      return
    const reg = await navigator.serviceWorker.ready
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(VAPID),
      }))
    // Cheap upsert; also restores it if the server dropped it
    if (navigator.onLine) await save(sub)
  } catch (e) {
    console.warn('Push refresh failed', e)
  }
}

export async function sendTestPush(): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ delivered: number; error?: string }>(
    'test-push',
  )
  if (error) throw new Error(data?.error ?? error.message)
}

/** On sign-out: stop this device getting the old account's reminders. Never throws. */
export async function forgetPushOnThisDevice(): Promise<void> {
  try {
    // getRegistration, not .ready: .ready never settles when no service worker is installed
    const sub = await (
      await navigator.serviceWorker?.getRegistration()
    )?.pushManager.getSubscription()
    if (!sub) return
    await supabase
      .from('push_subscriptions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  } catch {
    // Signing out matters more than tidying up
  }
}
