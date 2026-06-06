'use client'
import { Sidebar } from './Sidebar'

export function PageLayout({
  children,
  title,
  subtitle,
  onScan,
  scanning,
}: {
  children: React.ReactNode
  title: string
  subtitle?: string
  onScan?: () => void
  scanning?: boolean
}) {
  return (
    <div className="app-shell">
      <Sidebar onScan={onScan} scanning={scanning} />
      <div className="app-main">

        <div className="app-topbar">
          <div className="pill">
            <i className="ti ti-server" style={{ fontSize: 14 }} />AWS-PROD-AP-SOUTH-1
            <i className="ti ti-chevron-down" style={{ fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="pill search-pill">
              <i className="ti ti-search" style={{ fontSize: 15 }} />Search threats, assets...
            </div>
            <button className="icon-button" aria-label="Notifications">
              <i className="ti ti-bell" style={{ fontSize: 18 }} />
            </button>
          </div>
        </div>

        <div className="app-page-header">
          <h1 className="app-page-title">{title}</h1>
          {subtitle && <p className="app-page-subtitle">{subtitle}</p>}
        </div>

        <div className="app-content" style={{ overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
