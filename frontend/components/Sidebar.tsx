'use client'
import { usePathname, useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { icon: 'ti-layout-dashboard', label: 'Dashboard',    href: '/dashboard'    },
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
    <aside style={{
      width: 200, background: '#0a1929',
      borderRight: '1px solid #1a2d45',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #1a2d45' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-shield-lock" style={{ fontSize: 20, color: '#4fc3f7' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#4fc3f7', letterSpacing: '.5px' }}>
              CANOPY
            </div>
            <div style={{ fontSize: 10, color: '#37637a', letterSpacing: '1px', textTransform: 'uppercase', marginTop: 2 }}>
              AWS Security Platform
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0' }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href
          return (
            <div
              key={item.label}
              onClick={() => router.push(item.href)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 16px', fontSize: 12, cursor: 'pointer',
                color:      active ? '#4fc3f7' : '#607d8b',
                background: active ? '#0f2236' : 'transparent',
                borderLeft: active ? '2px solid #4fc3f7' : '2px solid transparent',
                transition: 'all .15s',
              }}
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
          style={{
            margin: '0 12px 12px', padding: '10px',
            background: scanning ? '#0f2236' : '#1565c0',
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 12, fontWeight: 500,
            cursor: scanning ? 'not-allowed' : 'pointer',
          }}
        >
          <i className="ti ti-player-play" style={{ fontSize: 12, marginRight: 4 }} />
          {scanning ? 'SCANNING...' : 'START SCAN'}
        </button>
      )}

      <div style={{ padding: '12px 16px', borderTop: '1px solid #1a2d45', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[['ti-file-description', 'Docs'], ['ti-logout', 'Logout']].map(([icon, label]) => (
          <div
            key={label}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#455a64', cursor: 'pointer' }}
          >
            <i className={`ti ${icon}`} style={{ fontSize: 14 }} />{label}
          </div>
        ))}
      </div>
    </aside>
  )
}
