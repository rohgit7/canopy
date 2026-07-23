'use client'

import { useEffect, useMemo, useState } from 'react'
import { useClerk, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Copy, LogOut, Settings, Shield } from 'lucide-react'
import { useScan } from '@/context/ScanContext'

const truncateValue = (value: string, maxLength = 32) => {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 12))}…${value.slice(-10)}`
}

export function UserMenu() {
  const router = useRouter()
  const { user } = useUser()
  const { signOut } = useClerk()
  const { connection } = useScan()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const roleArn = connection?.role_arn || (typeof window !== 'undefined' ? localStorage.getItem('canopyRoleArn') || localStorage.getItem('canopy_role_arn') : null)
  const accountId = connection?.account_id || (typeof window !== 'undefined' ? localStorage.getItem('canopyAwsAccountId') : null)
  const region = 'ap-south-1'

  useEffect(() => {
    if (!copied) return
    const timeout = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timeout)
  }, [copied])

  const displayName = useMemo(() => {
    if (!user) return 'User Profile'
    return user.fullName || user.username || user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || 'User Profile'
  }, [user])

  const accountLabel = accountId ? `AWS ${accountId}` : 'Not connected'
  const connectionStatus = roleArn || accountId ? 'Connected' : 'Not connected'
  const handleLogout = async () => {
    setOpen(false)
    await signOut({ redirectUrl: '/' })
  }


  const handleCopyArn = async () => {
    if (!roleArn) return
    try {
      await navigator.clipboard.writeText(roleArn)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="user-menu">
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen(open => !open)}
      >
        <span className="user-menu-avatar">{displayName?.charAt(0) || 'U'}</span>
        <span className="user-menu-meta">
          <span>{displayName}</span>
          <span>{accountLabel}</span>
        </span>
        {open ? <ChevronUp className="user-menu-toggle-icon" /> : <ChevronDown className="user-menu-toggle-icon" />}
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-section">
            <div className="user-menu-title">Profile</div>
            <div className="user-menu-row">
              <div>
                <div className="user-menu-label">User</div>
                <div className="user-menu-value">{displayName}</div>
              </div>
              <button
                type="button"
                className="user-menu-action"
                onClick={() => {
                  setOpen(false)
                  router.push('/settings')
                }}
              >
                <Settings className="user-menu-action-icon" /> Settings
              </button>
            </div>
          </div>

          <div className="user-menu-section">
            <div className="user-menu-title">AWS connection</div>
            <div className="user-menu-row">
              <div>
                <div className="user-menu-label">Status</div>
                <div className="user-menu-value">{connectionStatus}</div>
              </div>
              <div className={`user-menu-badge ${roleArn ? 'connected' : 'disconnected'}`}>{connectionStatus}</div>
            </div>
            <div className="user-menu-row">
              <div>
                <div className="user-menu-label">Account ID</div>
                <div className="user-menu-value">{accountId || 'No account connected'}</div>
              </div>
              <div className="user-menu-info-pill">{region || 'Region not set'}</div>
            </div>
            <div className="user-menu-row user-menu-copy-row">
              <div>
                <div className="user-menu-label">Role ARN</div>
                <div className="user-menu-value user-menu-arn">{roleArn ? truncateValue(roleArn) : 'No role ARN stored'}</div>
              </div>
              <button
                type="button"
                className="user-menu-copy"
                onClick={handleCopyArn}
                disabled={!roleArn}
              >
                <Copy className="user-menu-copy-icon" /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="user-menu-actions">
            <button
              type="button"
              className="user-menu-button"
              onClick={() => {
                setOpen(false)
                router.push('/settings')
              }}
            >
              <Shield className="user-menu-action-icon" /> Manage AWS
            </button>
            <button
              type="button"
              className="user-menu-button primary"
              onClick={handleLogout}
            >
              <LogOut className="user-menu-action-icon" /> Logout
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
