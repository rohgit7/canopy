'use client'
import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { SecurityGraph } from '@/components/SecurityGraph'
import { AttackPathCard } from '@/components/AttackPathCard'
import { Sidebar } from '@/components/Sidebar'
import { ScheduleScanModal } from '@/components/ScheduleScanModal'
import { useScan } from '@/context/ScanContext'
import { buildApiUrl, getScanHistory, ScanResult } from '@/lib/api'

export default function Dashboard() {
  const { getToken } = useAuth()
  const { scanId, setScanId, scanning, setScanning, results, setResults, connection, refreshData } = useScan()
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([])
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [csvNotice, setCsvNotice] = useState(false)

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

  const score = results?.score ?? null
  const accountLabel = connection?.account_id ? `AWS-${connection.account_id}` : 'AWS-DISCONNECTED'

  const statCards = [
    { label: 'AWS Resources', icon: 'ti-server', value: results?.resource_count ?? '-', sub: results ? `${results.node_count} nodes` : 'Run a scan', subColor: 'var(--green)' },
    { label: 'Critical Chains', icon: 'ti-link', value: results?.attack_paths?.filter((p: any) => p.exploitability === 'CRITICAL').length ?? '-', sub: results ? 'Active paths' : 'Run a scan', subColor: 'var(--orange)' },
    { label: 'Attack Paths', icon: 'ti-route', value: results?.attack_paths?.length ?? '-', sub: results ? 'Total found' : 'Run a scan', subColor: 'var(--orange)' },
    { label: 'Graph Edges', icon: 'ti-arrows-split-2', value: results?.edge_count ?? '-', sub: results ? 'Relationships' : 'Run a scan', subColor: 'var(--blue)' },
    { label: 'Risk Score', icon: 'ti-gauge', value: score !== null ? `${score.toFixed(0)}` : '-', sub: score !== null ? (score >= 80 ? 'Low risk' : score >= 50 ? 'Medium risk' : 'High risk') : 'Run a scan', subColor: score !== null ? (score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--orange)' : 'var(--red)') : 'var(--text-dim)' },
    { label: 'Scan Time', icon: 'ti-clock', value: scanning ? 'Live' : (results?.completed_at ? new Date(results.completed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-'), sub: scanning ? 'In progress' : 'Last scan', subColor: 'var(--text-dim)' },
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
              <div className="section-title">Recent Compliance Scans</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                  <tr>{['Scan ID', 'Target Environment', 'Status', 'Date', 'Resources', 'Score'].map(h => (
                    <th key={h}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {scanHistory.length > 0
                    ? scanHistory.map(s => {
                        const dateStr = s.completed_at
                          ? new Date(s.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                          : (s.started_at ? new Date(s.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-')
                        const isComplete = s.status === 'complete'
                        const isRunning = s.status === 'running'
                        return (
                          <tr key={s.scan_id}>
                            <td style={{ fontSize: 10, fontFamily: 'var(--font-geist-mono)', color: 'var(--cyan)', padding: 10 }}>
                              SCN-{s.scan_id.substring(0, 6)}
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text)', padding: 10 }}>
                              {connection?.account_id ? `AWS Account (${connection.account_id})` : 'AWS Environment'}
                            </td>
                            <td style={{ padding: 10 }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 9px', borderRadius: 999,
                                background: isComplete ? 'rgba(122, 161, 22, .14)' : isRunning ? 'rgba(255, 153, 0, .14)' : 'rgba(209, 50, 18, .14)',
                                color: isComplete ? 'var(--green)' : isRunning ? 'var(--orange)' : 'var(--red)',
                              }}>
                                <i className={`ti ${isComplete ? 'ti-circle-check' : isRunning ? 'ti-loader' : 'ti-alert-circle'}`} style={{ fontSize: 11 }} />
                                {s.status.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)', padding: 10 }}>{dateStr}</td>
                            <td style={{ fontSize: 12, color: 'var(--text)', padding: 10 }}>
                              {s.resource_count ?? '-'} resources ({s.node_count ?? 0} nodes)
                            </td>
                            <td style={{ padding: 10 }}>
                              {s.score !== undefined ? (
                                <span style={{
                                  fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                                  background: s.score >= 80 ? 'rgba(122, 161, 22, .14)' : s.score >= 50 ? 'rgba(255, 153, 0, .14)' : 'rgba(209, 50, 18, .14)',
                                  color: s.score >= 80 ? 'var(--green)' : s.score >= 50 ? 'var(--orange)' : 'var(--red)',
                                }}>
                                  {s.score.toFixed(0)}/100
                                </span>
                              ) : '-'}
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


