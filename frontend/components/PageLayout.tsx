'use client'
import { Sidebar } from './Sidebar'
import { UserMenu } from './UserMenu'
import { useScan } from '@/context/ScanContext'

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
  const { connection } = useScan()
  const accountLabel = connection?.account_id ? `AWS-${connection.account_id}` : 'AWS-DISCONNECTED'

  return (
    <div className="app-shell">
      <Sidebar onScan={onScan} scanning={scanning} />
      <div className="app-main">

        <div className="app-topbar">
          <div className="pill">
            <i className="ti ti-server" style={{ fontSize: 14 }} />{accountLabel}
            <i className="ti ti-chevron-down" style={{ fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <UserMenu />
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
