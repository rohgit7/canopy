'use client'
import { useEffect, useState, useCallback, type MouseEvent } from 'react'
import { useAuth } from '@clerk/nextjs'
import { SecurityGraph } from '@/components/SecurityGraph'
import { AttackPathCard } from '@/components/AttackPathCard'
import { Sidebar } from '@/components/Sidebar'
import { ScheduleScanModal } from '@/components/ScheduleScanModal'
import { UserMenu } from '@/components/UserMenu'
import { useScan } from '@/context/ScanContext'

import { buildApiUrl, getScanHistory, deleteScan, ScanResult } from '@/lib/api'

export default function Dashboard() {
  const { getToken } = useAuth()
  const { scanId, setScanId, scanning, setScanning, results, setResults, connection, refreshData, selectScan } = useScan()

  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([])
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [csvNotice, setCsvNotice] = useState(false)
  const [deletingScanId, setDeletingScanId] = useState<string | null>(null)

  const loadHistory = useCallback(async () => {
    try {
      const history = await getScanHistory('me')
      if (history && Array.isArray(history)) {
        setScanHistory(history)
      }
    } catch {
      // Ignore load error
    }
  }, [])

  const exportCsv = () => {
    const records = scanHistory.length > 0 ? scanHistory : (results ? [results] : [])
    if (records.length === 0) {
      alert('No scan data available to export.')
      return
    }

    const headers = ['Scan ID', 'Target Environment', 'Status', 'Date', 'Resource Count', 'Node Count', 'Risk Score']
    const rows = records.map(s => {
      const dateStr = s.completed_at
        ? new Date(s.completed_at).toISOString()
        : (s.started_at ? new Date(s.started_at).toISOString() : '')
      const targetEnv = connection?.account_id ? `AWS Account (${connection.account_id})` : 'AWS Environment'
      return [
        `SCN-${s.scan_id}`,
        `"${targetEnv}"`,
        s.status,
        `"${dateStr}"`,
        s.resource_count ?? 0,
        s.node_count ?? 0,
        s.score !== undefined ? s.score.toFixed(1) : ''
      ].join(',')
    })

    const csvContent = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `canopy_compliance_scans_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    setCsvNotice(true)
    setTimeout(() => setCsvNotice(false), 3000)
  }


  useEffect(() => {
    loadHistory()
  }, [results, scanning, loadHistory])

  const handleDeleteScan = async (scanId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    if (!confirm('Delete this scan? This action cannot be undone.')) return

    setDeletingScanId(scanId)
    try {
      const result = await deleteScan(scanId)
      if (!result) throw new Error('Delete failed')
      setScanHistory(prev => prev.filter(s => s.scan_id !== scanId))
      if (results?.scan_id === scanId) {
        refreshData()
      }
    } catch {
      setError('Unable to delete scan. Please try again.')
    } finally {
      setDeletingScanId(null)
    }
  }

  const scan = async () => {
    setScanning(true)
    setError(null)
    setResults(null)
    setProgress('Connecting to your AWS account...')
    try {
      const token = await getToken()
      const r = await fetch(buildApiUrl('/scan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customer_id: 'me' }),
      })
      const data = await r.json()
      setScanId(data.scan_id)
    } catch {
      setError('Cannot reach API. Is the backend running on port 8000?')
      setScanning(false)
    }
  }

  useEffect(() => {
    if (!scanId || !scanning) return
    const msgs = [
      'Extracting IAM roles and policies...',
      'Scanning EC2 instances across regions...',
      'Checking S3 buckets and Lambda functions...',
      'Building resource graph...',
      'Evaluating IAM policies...',
      'Running attack path algorithm...',
      'Calculating blast radius...',
      'Generating AI explanations...',
    ]
    let idx = 0
    const msgInt = setInterval(() => setProgress(msgs[idx++ % msgs.length]), 8000)
    const pollInt = setInterval(async () => {
      try {
        const r = await fetch(buildApiUrl(`/scan/${scanId}`))
        const data = await r.json()
        if (data.status === 'complete') {
          setResults(data)
          setScanning(false)
          clearInterval(msgInt)
          clearInterval(pollInt)
          refreshData()
          loadHistory()
        } else if (data.status === 'failed') {
          setError(data.error || 'Scan failed')
          setScanning(false)
          clearInterval(msgInt)
          clearInterval(pollInt)
          loadHistory()
        }
      } catch {
        // Keep polling while the backend finishes a long-running scan.
      }
    }, 3000)
    return () => {
      clearInterval(msgInt)
      clearInterval(pollInt)
    }
  }, [scanId, scanning, setResults, setScanning, refreshData, loadHistory])

  const formatScanTime = (isoStr?: string) => {
    if (!isoStr) return '-'
    const formattedIso = isoStr.endsWith('Z') || isoStr.includes('+') ? isoStr : `${isoStr}Z`
    const date = new Date(formattedIso)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const formatScanDate = (isoStr?: string) => {
    if (!isoStr) return '-'
    const formattedIso = isoStr.endsWith('Z') || isoStr.includes('+') ? isoStr : `${isoStr}Z`
    const date = new Date(formattedIso)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  }

  const getPathRisk = (p: any) => p.risk_score ?? Math.round(Math.max(10, Math.min(99, 100 - ((p.score || 0.5) * 15))))

  const envRiskScore = results ? (
    results.attack_paths && results.attack_paths.length > 0
      ? Math.max(...results.attack_paths.map(getPathRisk))
      : (results.score !== undefined && results.score !== null ? Math.round(Math.max(0, Math.min(100, 100 - results.score))) : 0)
  ) : null

  const accountLabel = connection?.account_id ? `AWS-${connection.account_id}` : 'AWS-DISCONNECTED'

  const statCards = [
    { label: 'AWS Resources', icon: 'ti-server', value: results?.resource_count ?? '-', sub: results ? `${results.node_count} nodes` : 'Run a scan', subColor: 'var(--green)' },
    { label: 'Critical Chains', icon: 'ti-link', value: results?.attack_paths?.filter((p: any) => p.exploitability === 'CRITICAL').length ?? '-', sub: results ? 'Active paths' : 'Run a scan', subColor: 'var(--orange)' },
    { label: 'Attack Paths', icon: 'ti-route', value: results?.attack_paths?.length ?? '-', sub: results ? 'Total found' : 'Run a scan', subColor: 'var(--orange)' },
    { label: 'Graph Edges', icon: 'ti-arrows-split-2', value: results?.edge_count ?? '-', sub: results ? 'Relationships' : 'Run a scan', subColor: 'var(--blue)' },
    {
      label: 'Risk Score',
      icon: 'ti-gauge',
      value: envRiskScore !== null ? `${envRiskScore}/100` : '-',
      sub: envRiskScore !== null ? (envRiskScore >= 80 ? 'Critical risk' : envRiskScore >= 50 ? 'High risk' : envRiskScore >= 20 ? 'Medium risk' : 'Low risk') : 'Run a scan',
      subColor: envRiskScore !== null ? (envRiskScore >= 80 ? 'var(--red)' : envRiskScore >= 50 ? 'var(--orange)' : envRiskScore >= 20 ? 'var(--blue)' : 'var(--green)') : 'var(--text-dim)'
    },
    { label: 'Scan Time', icon: 'ti-clock', value: scanning ? 'Live' : formatScanTime(results?.completed_at || results?.started_at), sub: scanning ? 'In progress' : 'Last scan', subColor: 'var(--text-dim)' },
  ]

  return (
    <div className="app-shell">
      <Sidebar onScan={scan} scanning={scanning} />
      <div className="app-main">
        <div className="app-topbar">
          <div className="pill" style={{ cursor: 'pointer' }}>
            <i className="ti ti-server" style={{ fontSize: 14 }} />{accountLabel}
            <i className="ti ti-chevron-down" style={{ fontSize: 13 }} />
          </div>

          {scanning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--green)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 14px rgba(122, 161, 22, .75)', animation: 'pulse 1.5s infinite' }} />
              {progress}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div className="pill search-pill">
              <i className="ti ti-search" style={{ fontSize: 15 }} />Search threats, assets...
            </div>
            <button className="icon-button" aria-label="Notifications">
              <i className="ti ti-bell" style={{ fontSize: 18 }} />
            </button>
            <UserMenu />
          </div>

        </div>

        <div className="app-content">
          {error && (
            <div style={{ background: 'rgba(209, 50, 18, .16)', border: '1px solid rgba(209, 50, 18, .32)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: 'var(--red)', fontSize: 12 }}>
              <i className="ti ti-alert-triangle" style={{ marginRight: 6 }} />{error}
            </div>
          )}

          <div className="stat-grid">
            {statCards.map(card => (
              <div key={card.label} className="panel stat-card">
                <div className="stat-label">
                  {card.label}<i className={`ti ${card.icon}`} style={{ fontSize: 16, color: 'var(--orange)' }} />
                </div>
                <div className="stat-value">{card.value}</div>
                <div className="stat-sub" style={{ color: card.subColor }}>{card.sub}</div>
              </div>
            ))}
          </div>

          <div className="dashboard-grid">
            <div className="panel" style={{ padding: 16, maxHeight: 340, overflow: 'auto' }}>
              <div className="section-title" style={{ marginBottom: 12 }}>
                Attack Paths {results && `(${results.attack_paths?.length ?? 0})`}
              </div>
              {!results && <div style={{ fontSize: 12, color: 'var(--text-dim)', textAlign: 'center', paddingTop: 48 }}>Run a scan to see attack paths</div>}
              {results?.attack_paths?.length === 0 && <div style={{ fontSize: 12, color: 'var(--green)', textAlign: 'center', paddingTop: 48 }}>No attack paths found</div>}
              {results?.attack_paths?.map((path: any, i: number) => (
                <AttackPathCard key={i} path={path} />
              ))}
            </div>

            <div className="panel" style={{ padding: 16, height: 340 }}>
              <div className="section-title" style={{ marginBottom: 8 }}>Resource Graph</div>
              {results?.graph_data
                ? <SecurityGraph data={results.graph_data} attackPaths={results.attack_paths || []} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '85%', color: 'var(--text-dim)', fontSize: 12 }}>
                    <i className="ti ti-topology-star-3" style={{ fontSize: 34, display: 'block', textAlign: 'center', marginBottom: 8, color: 'var(--blue)' }} />
                  </div>
              }
            </div>
          </div>

          <div className="panel" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <div className="section-title">Recent Compliance Scans</div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                  Click any scan below to view its security graph, attack paths, and risk score metrics
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                {results?.scan_id && scanHistory.length > 0 && results.scan_id !== scanHistory[0]?.scan_id && (
                  <button
                    type="button"
                    onClick={refreshData}
                    style={{
                      fontSize: 11, padding: '7px 12px', borderRadius: 8,
                      border: '1px solid rgba(255, 153, 0, 0.4)', color: 'var(--orange)',
                      background: 'rgba(255, 153, 0, 0.12)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 5, fontWeight: 600
                    }}
                  >
                    <i className="ti ti-rotate-clockwise" style={{ fontSize: 12 }} />Reset to Latest
                  </button>
                )}
                {csvNotice && (
                  <span style={{ fontSize: 11, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <i className="ti ti-check" /> Exported CSV!
                  </span>
                )}
                <button
                  type="button"
                  onClick={exportCsv}
                  style={{
                    fontSize: 11, padding: '7px 12px', borderRadius: 8,
                    border: '1px solid var(--border)', color: 'var(--text-muted)',
                    background: 'rgba(35, 47, 62, .6)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500
                  }}
                >
                  <i className="ti ti-download" style={{ fontSize: 12 }} />Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(true)}
                  style={{
                    fontSize: 11, padding: '7px 12px', borderRadius: 8,
                    border: '1px solid rgba(255, 153, 0, .35)', color: '#111827',
                    background: 'linear-gradient(135deg, #ff9900, #ec7211)', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 5, fontWeight: 700
                  }}
                >
                  <i className="ti ti-calendar" style={{ fontSize: 12 }} />Schedule Scan
                </button>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {['Scan ID', 'Target Environment', 'Compliance Status', 'Date', 'Resources', 'Risk Score'].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {scanHistory.length > 0
                    ? scanHistory.map(s => {
                        const dateStr = formatScanDate(s.completed_at || s.started_at)
                        const isComplete = s.status === 'complete'
                        const isRunning = s.status === 'running'
                        const isCompliant = isComplete && (s.score === undefined || s.score >= 80)
                        const isSelected = results?.scan_id === s.scan_id
                        const rScore = s.score !== undefined ? Math.round(Math.max(0, Math.min(100, 100 - s.score))) : null
                        
                        return (
                          <tr
                            key={s.scan_id}
                            onClick={() => selectScan(s.scan_id)}
                            style={{
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(255, 153, 0, 0.12)' : undefined,
                              borderLeft: isSelected ? '3px solid var(--orange)' : '3px solid transparent',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <td style={{ fontSize: 10, fontFamily: 'var(--font-geist-mono)', color: isSelected ? 'var(--orange)' : 'var(--cyan)', padding: 10, fontWeight: isSelected ? 700 : 400 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                SCN-{s.scan_id.substring(0, 6)}
                                {isSelected && (
                                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: 'var(--orange)', color: '#111827', letterSpacing: '0.04em' }}>
                                    VIEWING
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text)', padding: 10 }}>
                              {connection?.account_id ? `AWS Account (${connection.account_id})` : 'AWS Environment'}
                            </td>
                            <td style={{ padding: 10 }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 9px', borderRadius: 999, fontWeight: 600,
                                background: isRunning
                                  ? 'rgba(255, 153, 0, .14)'
                                  : isCompliant
                                  ? 'rgba(122, 161, 22, .14)'
                                  : 'rgba(209, 50, 18, .14)',
                                color: isRunning
                                  ? 'var(--orange)'
                                  : isCompliant
                                  ? 'var(--green)'
                                  : 'var(--red)',
                              }}>
                                <i className={`ti ${isRunning ? 'ti-loader' : isCompliant ? 'ti-shield-check' : 'ti-shield-x'}`} style={{ fontSize: 11 }} />
                                {isRunning ? 'SCANNING' : isCompliant ? 'COMPLIANT' : 'NON-COMPLIANT'}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)', padding: 10 }}>{dateStr}</td>
                            <td style={{ fontSize: 12, color: 'var(--text)', padding: 10 }}>
                              {s.resource_count ?? '-'} resources ({s.node_count ?? 0} nodes)
                            </td>
                            <td style={{ padding: 10 }}>
                              {rScore !== null ? (
                                <span style={{
                                  fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                                  background: rScore >= 80 ? 'rgba(209, 50, 18, .14)' : rScore >= 50 ? 'rgba(255, 153, 0, .14)' : 'rgba(122, 161, 22, .14)',
                                  color: rScore >= 80 ? 'var(--red)' : rScore >= 50 ? 'var(--orange)' : 'var(--green)',
                                }}>
                                  {rScore}/100 Risk
                                </span>
                              ) : '-'}
                            </td>
                            <td style={{ padding: 10, textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={(event) => handleDeleteScan(s.scan_id, event)}
                                disabled={deletingScanId === s.scan_id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  fontSize: 11,
                                  padding: '7px 10px',
                                  borderRadius: 8,
                                  background: 'rgba(209, 50, 18, 0.12)',
                                  color: 'var(--danger)',
                                  border: '1px solid rgba(209, 50, 18, 0.24)',
                                  cursor: deletingScanId === s.scan_id ? 'not-allowed' : 'pointer',
                                }}
                              >
                                <i className="ti ti-trash" style={{ fontSize: 11 }} />
                                {deletingScanId === s.scan_id ? 'Deleting...' : 'Delete'}
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    : <tr>
                        <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 24, fontSize: 12 }}>
                          No scan history found in database. Click "START SCAN" to run your first scan.
                        </td>
                      </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>


      <ScheduleScanModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        accountId={connection?.account_id}
      />

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  )
}


