'use client'
import { useState, useEffect } from 'react'

export interface ScheduleConfig {
  enabled: boolean
  frequency: 'daily' | 'weekly' | 'monthly' | 'custom'
  time: string
  dayOfWeek: string
  notifications: string
  lastUpdated?: string
}

interface ScheduleScanModalProps {
  isOpen: boolean
  onClose: () => void
  accountId?: string
}

export function ScheduleScanModal({ isOpen, onClose, accountId }: ScheduleScanModalProps) {
  const [enabled, setEnabled] = useState(true)
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'custom'>('daily')
  const [time, setTime] = useState('02:00')
  const [dayOfWeek, setDayOfWeek] = useState('Monday')
  const [notifications, setNotifications] = useState('email')
  const [savedSuccess, setSavedSuccess] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('canopy_scan_schedule')
      if (stored) {
        try {
          const parsed: ScheduleConfig = JSON.parse(stored)
          setEnabled(parsed.enabled)
          setFrequency(parsed.frequency)
          setTime(parsed.time || '02:00')
          setDayOfWeek(parsed.dayOfWeek || 'Monday')
          setNotifications(parsed.notifications || 'email')
        } catch {
          // fallback to defaults
        }
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = () => {
    const config: ScheduleConfig = {
      enabled,
      frequency,
      time,
      dayOfWeek,
      notifications,
      lastUpdated: new Date().toISOString(),
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('canopy_scan_schedule', JSON.stringify(config))
    }
    setSavedSuccess(true)
    setTimeout(() => {
      setSavedSuccess(false)
      onClose()
    }, 1200)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(5, 12, 20, 0.75)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{
        width: '100%', maxWidth: 480, background: '#0a1929',
        border: '1px solid #1a2d45', borderRadius: 12, padding: 24,
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)', color: '#e1f5fe'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(255, 153, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="ti ti-calendar-time" style={{ fontSize: 18, color: 'var(--orange)' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Schedule Automated Scan</h3>
              <p style={{ margin: 0, fontSize: 11, color: '#607d8b' }}>
                {accountId ? `Target: AWS Account (${accountId})` : 'Target: AWS Production'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#607d8b', cursor: 'pointer', fontSize: 18 }}
          >
            ✕
          </button>
        </div>

        {/* Toggle active */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', background: '#0f2236', borderRadius: 8, marginBottom: 18, border: '1px solid #1a2d45'
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#e1f5fe' }}>Enable Recurring Scan</div>
            <div style={{ fontSize: 10, color: '#607d8b' }}>Automatically trigger full resource scan on schedule</div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: 42, height: 22, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{
              position: 'absolute', inset: 0, borderRadius: 22,
              background: enabled ? 'var(--orange)' : '#1a2d45',
              transition: '.3s',
            }}>
              <span style={{
                position: 'absolute', content: '""', height: 16, width: 16, left: enabled ? 22 : 3, bottom: 3,
                background: '#fff', borderRadius: '50%', transition: '.3s'
              }} />
            </span>
          </label>
        </div>

        {/* Form options */}
        <div style={{ display: 'grid', gap: 14, opacity: enabled ? 1 : 0.5, pointerEvents: enabled ? 'auto' : 'none' }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#607d8b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.6px' }}>
              Frequency
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              {(['daily', 'weekly', 'monthly', 'custom'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFrequency(f)}
                  style={{
                    padding: '8px 4px', fontSize: 11, textTransform: 'capitalize', borderRadius: 6,
                    border: `1px solid ${frequency === f ? 'var(--orange)' : '#1a2d45'}`,
                    background: frequency === f ? 'rgba(255, 153, 0, 0.12)' : '#07111f',
                    color: frequency === f ? 'var(--orange)' : '#b0bec5',
                    cursor: 'pointer', fontWeight: frequency === f ? 600 : 400
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {frequency === 'weekly' && (
            <div>
              <label style={{ display: 'block', fontSize: 11, color: '#607d8b', marginBottom: 6 }}>
                Day of Week
              </label>
              <select
                value={dayOfWeek}
                onChange={e => setDayOfWeek(e.target.value)}
                style={{
                  width: '100%', background: '#07111f', border: '1px solid #1a2d45',
                  borderRadius: 6, padding: '8px 12px', color: '#b0bec5', fontSize: 12, outline: 'none'
                }}
              >
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#607d8b', marginBottom: 6 }}>
              Preferred Execution Time (UTC)
            </label>
            <input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              style={{
                width: '100%', background: '#07111f', border: '1px solid #1a2d45',
                borderRadius: 6, padding: '8px 12px', color: '#b0bec5', fontSize: 12, outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, color: '#607d8b', marginBottom: 6 }}>
              Alert Notification Channel
            </label>
            <select
              value={notifications}
              onChange={e => setNotifications(e.target.value)}
              style={{
                width: '100%', background: '#07111f', border: '1px solid #1a2d45',
                borderRadius: 6, padding: '8px 12px', color: '#b0bec5', fontSize: 12, outline: 'none'
              }}
            >
              <option value="email">Email Alert on High/Critical findings</option>
              <option value="slack">Slack Webhook Notification</option>
              <option value="in_app">In-App Dashboard Notification Only</option>
            </select>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 24, paddingTop: 14, borderTop: '1px solid #1a2d45' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px', background: 'transparent', border: '1px solid #1a2d45',
              borderRadius: 6, color: '#607d8b', fontSize: 12, cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '8px 18px', background: 'linear-gradient(135deg, #ff9900, #ec7211)',
              border: 'none', borderRadius: 6, color: '#111827', fontWeight: 700, fontSize: 12, cursor: 'pointer'
            }}
          >
            {savedSuccess ? '✓ Saved!' : 'Save Schedule'}
          </button>
        </div>
      </div>
    </div>
  )
}
