// Last-resort safety net: if the app hasn't drawn anything after 12 s (e.g. its code failed
// to load), show what went wrong plus Reload / Reset instead of a blank screen.
;(function () {
  var errors = []
  window.addEventListener('error', function (e) {
    errors.push(e.message || String(e))
  })
  window.addEventListener('unhandledrejection', function (e) {
    errors.push(String((e.reason && e.reason.message) || e.reason))
  })
  var done = location.reload.bind(location)
  window.__trainerReset = function () {
    var jobs = []
    if (navigator.serviceWorker)
      jobs.push(
        navigator.serviceWorker.getRegistrations().then(function (rs) {
          return Promise.all(
            rs.map(function (r) {
              return r.unregister()
            }),
          )
        }),
      )
    if (window.caches)
      jobs.push(
        caches.keys().then(function (ks) {
          return Promise.all(
            ks.map(function (k) {
              return caches.delete(k)
            }),
          )
        }),
      )
    Promise.all(jobs).then(done, done)
  }
  setTimeout(function () {
    var root = document.getElementById('root')
    if (root && root.children.length > 0) return
    var dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.body.style.cssText =
      'margin:0;font-family:-apple-system,system-ui,sans-serif;background:' +
      (dark ? '#0b0f14;color:#e8edf2' : '#f6f7f9;color:#0f141a')
    var btn =
      'display:block;width:100%;height:48px;margin-top:10px;border:0;border-radius:12px;font-size:16px;font-weight:600;'
    root.innerHTML =
      '<div style="padding:calc(env(safe-area-inset-top) + 48px) 24px 24px;text-align:center">' +
      '<p style="font-size:20px;font-weight:700">Trainer didn’t load</p>' +
      '<p style="opacity:.7">Your workouts are safe on this phone.</p>' +
      (errors.length
        ? '<pre style="text-align:left;white-space:pre-wrap;font-size:12px;opacity:.7">' +
          errors.join('\n').replace(/</g, '&lt;') +
          '</pre>'
        : '') +
      '<button style="' +
      btn +
      'background:#2dd4bf;color:#04201c" id="boot-reload">Reload</button>' +
      '<button style="' +
      btn +
      'background:#888;color:#fff" id="boot-reset">Reset app (keeps your workouts)</button>' +
      '</div>'
    // Listeners rather than onclick, so the page's security policy can block inline script
    document.getElementById('boot-reload').addEventListener('click', function () {
      location.reload()
    })
    document.getElementById('boot-reset').addEventListener('click', window.__trainerReset)
  }, 12000)
})()
