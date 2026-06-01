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
    <div style={{ display: 'flex', height: '100vh', background: '#07111f', color: '#b0bec5', fontFamily: 'system-ui, sans-serif' }}>
      <Sidebar onScan={onScan} scanning={scanning} />
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #1a2d45', background: '#0a1929', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#90caf9', background: '#0f2236', border: '1px solid #1a2d45', borderRadius: 6, padding: '5px 10px' }}>
            <i className="ti ti-server" style={{ fontSize: 14 }} />AWS-PROD-AP-SOUTH-1
            <i className="ti ti-chevron-down" style={{ fontSize: 13 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f2236', border: '1px solid #1a2d45', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#455a64' }}>
              <i className="ti ti-search" style={{ fontSize: 15 }} />Search threats, assets...
            </div>
            <i className="ti ti-bell" style={{ fontSize: 18, color: '#37637a', cursor: 'pointer' }} />
          </div>
        </div>

        {/* Page header */}
        <div style={{ padding: '20px 24px 0', borderBottom: '1px solid #1a2d45', paddingBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: '#e1f5fe', margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ fontSize: 12, color: '#455a64', margin: '4px 0 0' }}>{subtitle}</p>}
        </div>

        {/* Page content */}
        <div style={{ padding: '20px 24px', flex: 1, overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}