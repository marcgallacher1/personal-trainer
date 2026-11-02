/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (string | PrecacheEntry)[]
}

// --- App shell: precache the build and serve index.html for every in-app navigation (offline SPA).
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

void self.skipWaiting()
clientsClaim()

// --- Push (server-sent via Web Push; wired up server-side in Phase 4).
interface PushPayload {
  title: string
  body?: string
  /** In-app path to open on tap, e.g. '/log' or '/report/2026-W44' */
  url?: string
  tag?: string
}

function parsePayload(data: PushMessageData | null): PushPayload {
  if (!data) return { title: 'Trainer' }
  try {
    const json = data.json() as Partial<PushPayload>
    return { title: json.title ?? 'Trainer', ...json }
  } catch {
    return { title: 'Trainer', body: data.text() }
  }
}

self.addEventListener('push', (event) => {
  const p = parsePayload(event.data)
  event.waitUntil(
    self.registration.showNotification(p.title, {
      body: p.body,
      tag: p.tag,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      data: { url: p.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data as { url?: string } | undefined
  const target = new URL(data?.url ?? '/', self.location.origin).href

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows[0]
      if (existing) {
        await existing.focus()
        // Let the app route client-side so in-memory state (e.g. a live session) survives.
        existing.postMessage({ type: 'navigate', url: data?.url ?? '/' })
        return
      }
      await self.clients.openWindow(target)
    })(),
  )
})

// The browser replaced the subscription: re-subscribe now; the app sends it to the server when opened.
self.addEventListener('pushsubscriptionchange', (event) => {
  const e = event as Event & {
    oldSubscription?: PushSubscription | null
    waitUntil: (p: Promise<unknown>) => void
  }
  const key = e.oldSubscription?.options.applicationServerKey
  if (!key) return
  e.waitUntil(
    self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }),
  )
})
