'use client'
import { usePathname, useRouter } from 'next/navigation'

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

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="brand-mark">
            <i className="ti ti-shield-lock" style={{ fontSize: 20 }} />
          </div>
          <div>
            <div className="brand-title">CANOPY</div>
            <div className="brand-subtitle">AWS Security Platform</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <div
              key={item.label}
              onClick={() => router.push(item.href)}
              className={`sidebar-link${active ? ' active' : ''}`}
            >
              <i className={`ti ${item.icon}`} style={{ fontSize: 16 }} />
              {item.label}
            </div>
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
        {[['ti-file-description', 'Docs'], ['ti-logout', 'Logout']].map(([icon, label]) => (
          <div
            key={label}
            className="sidebar-footer-link"
          >
            <i className={`ti ${icon}`} style={{ fontSize: 14 }} />{label}
          </div>
        ))}
      </div>
    </aside>
  )
}
