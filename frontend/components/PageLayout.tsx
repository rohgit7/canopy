'use client'
import { useClerk, useUser } from '@clerk/nextjs'
import { useState } from 'react'
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
  const { user, isLoaded } = useUser()
  const { signOut } = useClerk()
  const [menuOpen, setMenuOpen] = useState(false)

  const displayName = user?.fullName || user?.firstName || user?.emailAddresses?.[0]?.emailAddress || 'User'
  const arn = typeof window !== 'undefined' ? window.localStorage.getItem('canopy_role_arn') : null

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

            <div style={{ position: 'relative' }}>
              <button
                className="icon-button"
                aria-label="User menu"
                onClick={() => setMenuOpen((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--aws-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                  {isLoaded && user ? (user.firstName?.[0] || user.emailAddresses?.[0]?.emailAddress?.[0] || 'U') : 'U'}
                </div>
                <i className="ti ti-chevron-down" style={{ fontSize: 12 }} />
              </button>

              {menuOpen && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 280, background: '#07121a', border: '1px solid #1a2d45', borderRadius: 12, boxShadow: '0 12px 32px rgba(0,0,0,0.35)', zIndex: 1000 }}>
                  <div style={{ padding: 14, borderBottom: '1px solid #112233' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#eaf6ff' }}>{isLoaded ? displayName : 'Loading...'}</div>
                    <div style={{ fontSize: 12, color: '#7f93a5', marginTop: 2 }}>{user?.primaryEmailAddress?.emailAddress || user?.emailAddresses?.[0]?.emailAddress || 'No email'}</div>
                  </div>

                  <div style={{ padding: 14, borderBottom: '1px solid #112233', display: 'grid', gap: 8 }}>
                    <div style={{ fontSize: 12, color: '#7f93a5' }}>Connected account</div>
                    <div style={{ fontSize: 12, color: '#dce7ef', wordBreak: 'break-all' }}>{arn || 'No AWS role ARN connected yet'}</div>
                    <div style={{ fontSize: 12, color: '#7f93a5' }}>Status: {arn ? 'Connected' : 'Not connected'}</div>
                  </div>

                  <div style={{ padding: 10, display: 'grid', gap: 8 }}>
                    <button type="button" style={{ background: 'transparent', border: 'none', color: '#dce7ef', textAlign: 'left', padding: 6, cursor: 'pointer', borderRadius: 6 }} onClick={() => setMenuOpen(false)}>
                      <i className="ti ti-user" style={{ marginRight: 8 }} />My Profile
                    </button>
                    <button type="button" style={{ background: 'transparent', border: 'none', color: '#dce7ef', textAlign: 'left', padding: 6, cursor: 'pointer', borderRadius: 6 }} onClick={() => signOut({ redirectUrl: '/' })}>
                      <i className="ti ti-logout" style={{ marginRight: 8 }} />Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
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
