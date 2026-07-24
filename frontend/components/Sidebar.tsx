'use client'
import { useClerk } from '@clerk/nextjs'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect } from 'react'

const NAV_ITEMS = [
  { icon: 'ti-layout-dashboard', label: 'Dashboard',    href: '/dashboard'    },
  { icon: 'ti-resource-graph', label: 'Resource Graph', href: '/resource-graph' },
  { icon: 'ti-route',            label: 'Attack Paths', href: '/attack-paths' },
  { icon: 'ti-cloud',            label: 'Resources',    href: '/resources'    },
  { icon: 'ti-key',              label: 'IAM Analyzer', href: '/iam-analyzer' },
  { icon: 'ti-ripple',           label: 'Blast Radius', href: '/blast-radius' },
  { icon: 'ti-report-analytics', label: 'AI Reports',   href: '/ai-reports'   },
  { icon: 'ti-plug',             label: 'Integrations', href: '/integrations' },
  { icon: 'ti-settings',         label: 'Settings',     href: '/settings'     },
]

export function Sidebar({ onScan, scanning }: {
  onScan?: () => void
  scanning?: boolean
}) {
  const pathname = usePathname()
  const router   = useRouter()
  const { signOut } = useClerk()

  useEffect(() => {
    NAV_ITEMS.forEach(item => {
      router.prefetch(item.href)
    })
    router.prefetch('/docs')
  }, [router])

  const handleLogout = async () => {
    await signOut({ redirectUrl: '/' })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="brand-mark">
            <img src="/canopy-logo.svg" alt="Canopy logo" className="brand-logo" />
          </div>
          <div>
            <div className="brand-title">CANOPY</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`sidebar-link${active ? ' active' : ''}`}
            >
              <i className={`ti ${item.icon}`} style={{ fontSize: 16 }} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {onScan && (
        <button
          onClick={onScan}
          disabled={scanning}
          className="scan-button"
        >
          <i className="ti ti-player-play" style={{ fontSize: 12, marginRight: 4 }} />
          {scanning ? 'SCANNING...' : 'START SCAN'}
        </button>
      )}

      <div className="sidebar-footer">
        <Link
          href="/docs"
          className="sidebar-footer-link"
        >
          <i className="ti ti-file-description" style={{ fontSize: 14 }} />Docs
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="sidebar-footer-link"
          style={{ border: 'none', background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer' }}
        >
          <i className="ti ti-logout" style={{ fontSize: 14 }} />Logout
        </button>
      </div>
    </aside>
  )
}
