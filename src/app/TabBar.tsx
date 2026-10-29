import { NavLink } from 'react-router'

const TABS = [
  {
    to: '/',
    label: 'Today',
    icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  },
  { to: '/log', label: 'Log', icon: 'M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11' },
  { to: '/progress', label: 'Progress', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/plans', label: 'Plans', icon: 'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01' },
  { to: '/more', label: 'More', icon: 'M5 12h.01M12 12h.01M19 12h.01' },
] as const

export function TabBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface/90 pb-safe backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-1 text-xs ${isActive ? 'text-accent' : 'text-muted'}`
              }
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d={t.icon} />
              </svg>
              {t.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
