'use client'
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { SecurityGraph } from '@/components/SecurityGraph'
import { AttackPathCard } from '@/components/AttackPathCard'
import { Sidebar } from '@/components/Sidebar'

const API = process.env.NEXT_PUBLIC_API_URL

export default function Dashboard() {
  const { getToken } = useAuth()
  const [scanId, setScanId] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [results, setResults] = useState<any>(null)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)

  const scan = async () => {
    setScanning(true)
    setError(null)
    setResults(null)
    setProgress('Connecting to your AWS account...')
    try {
      const token = await getToken()
      const r = await fetch(`${API}/scan`, {
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
        const r = await fetch(`${API}/scan/${scanId}`)
        const data = await r.json()
        if (data.status === 'complete') {
          setResults(data)
          setScanning(false)
          clearInterval(msgInt)
          clearInterval(pollInt)
        } else if (data.status === 'failed') {
          setError(data.error || 'Scan failed')
          setScanning(false)
          clearInterval(msgInt)
          clearInterval(pollInt)
        }
      } catch {
        // Keep polling while the backend finishes a long-running scan.
      }
    }, 3000)
    return () => {
      clearInterval(msgInt)
      clearInterval(pollInt)
    }
  }, [scanId, scanning])

  const score = results?.score ?? null

  const statCards = [
    { label: 'AWS Resources', icon: 'ti-server', value: results?.resource_count ?? '-', sub: results ? `${results.node_count} nodes` : 'Run a scan', subColor: 'var(--green)' },
    { label: 'Critical Chains', icon: 'ti-link', value: results?.attack_paths?.filter((p: any) => p.exploitability === 'CRITICAL').length ?? '-', sub: results ? 'Active paths' : 'Run a scan', subColor: 'var(--orange)' },
    { label: 'Attack Paths', icon: 'ti-route', value: results?.attack_paths?.length ?? '-', sub: results ? 'Total found' : 'Run a scan', subColor: 'var(--orange)' },
    { label: 'Graph Edges', icon: 'ti-arrows-split-2', value: results?.edge_count ?? '-', sub: results ? 'Relationships' : 'Run a scan', subColor: 'var(--blue)' },
    { label: 'Risk Score', icon: 'ti-gauge', value: score !== null ? `${score.toFixed(0)}` : '-', sub: score !== null ? (score >= 80 ? 'Low risk' : score >= 50 ? 'Medium risk' : 'High risk') : 'Run a scan', subColor: score !== null ? (score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--orange)' : 'var(--red)') : 'var(--text-dim)' },
    { label: 'Scan Time', icon: 'ti-clock', value: scanning ? 'Live' : (results ? new Date(results.completed_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '-'), sub: scanning ? 'In progress' : 'Last scan', subColor: 'var(--text-dim)' },
  ]

  return (
    <div className="app-shell">
      <Sidebar onScan={scan} scanning={scanning} />
      <div className="app-main">
        <div className="app-topbar">
          <div className="pill" style={{ cursor: 'pointer' }}>
            <i className="ti ti-server" style={{ fontSize: 14 }} />AWS-PROD-AP-SOUTH-1
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
                ? <SecurityGraph data={results.graph_data} attackPaths={results.attack_paths} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '85%', color: 'var(--text-dim)', fontSize: 12 }}>
                    <i className="ti ti-topology-star-3" style={{ fontSize: 34, display: 'block', textAlign: 'center', marginBottom: 8, color: 'var(--blue)' }} />
                  </div>
              }
            </div>
          </div>

          <div className="panel" style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div className="section-title">Recent Compliance Scans</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  ['ti-download', 'Export CSV', false],
                  ['ti-calendar', 'Schedule Scan', true],
                ].map(([icon, label, primary]) => (
                  <button key={label as string} style={{ fontSize: 11, padding: '7px 12px', borderRadius: 8, border: `1px solid ${primary ? 'rgba(255, 153, 0, .35)' : 'var(--border)'}`, color: primary ? '#111827' : 'var(--text-muted)', background: primary ? 'linear-gradient(135deg, #ff9900, #ec7211)' : 'rgba(35, 47, 62, .6)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: primary ? 700 : 500 }}>
                    <i className={`ti ${icon}`} style={{ fontSize: 12 }} />{label}
                  </button>
                ))}
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>{['Scan ID', 'Target Environment', 'Status', 'Completed', 'Findings', 'Action'].map(h => (
                    <th key={h}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {results
                    ? <tr>
                        <td style={{ fontSize: 10, fontFamily: 'var(--font-geist-mono)', color: 'var(--cyan)', padding: 10 }}>SCN-{Math.floor(Math.random() * 9000 + 1000)}</td>
                        <td style={{ fontSize: 12, color: 'var(--text)', padding: 10 }}>Production - AP South</td>
                        <td style={{ padding: 10 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 9px', borderRadius: 999, background: 'rgba(122, 161, 22, .14)', color: 'var(--green)' }}><i className="ti ti-circle-check" style={{ fontSize: 11 }} />Completed</span></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', padding: 10 }}>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td style={{ padding: 10 }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[
                              ['CRIT', results.attack_paths?.filter((p: any) => p.exploitability === 'CRITICAL').length ?? 0, 'rgba(209, 50, 18, .14)', 'var(--red)'],
                              ['HIGH', results.attack_paths?.filter((p: any) => p.exploitability === 'HIGH').length ?? 0, 'rgba(255, 153, 0, .14)', 'var(--orange)'],
                              ['MED', results.attack_paths?.filter((p: any) => p.exploitability === 'MEDIUM').length ?? 0, 'rgba(20, 110, 180, .16)', 'var(--blue)'],
                            ].map(([l, v, bg, col]) => (
                              <span key={l as string} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, fontWeight: 650, background: bg as string, color: col as string }}>{l}: {v}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: 10 }}><i className="ti ti-eye" style={{ fontSize: 16, color: 'var(--text-muted)', cursor: 'pointer' }} /></td>
                      </tr>
                    : [['SCN-4421', 'Production Cluster', 'Oct 24, 2023', '12', '43', '88'], ['SCN-4420', 'Staging Environment', 'Oct 23, 2023', '3', '17', '42']].map(row => (
                        <tr key={row[0]}>
                          <td style={{ fontSize: 10, fontFamily: 'var(--font-geist-mono)', color: 'var(--cyan)', padding: 10 }}>{row[0]}</td>
                          <td style={{ fontSize: 12, color: 'var(--text)', padding: 10 }}>{row[1]}</td>
                          <td style={{ padding: 10 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '3px 9px', borderRadius: 999, background: 'rgba(122, 161, 22, .14)', color: 'var(--green)' }}><i className="ti ti-circle-check" style={{ fontSize: 11 }} />Completed</span></td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)', padding: 10 }}>{row[2]}</td>
                          <td style={{ padding: 10 }}><div style={{ display: 'flex', gap: 4 }}><span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(209, 50, 18, .14)', color: 'var(--red)' }}>{row[3]}</span><span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(255, 153, 0, .14)', color: 'var(--orange)' }}>{row[4]}</span><span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 999, background: 'rgba(20, 110, 180, .16)', color: 'var(--blue)' }}>{row[5]}</span></div></td>
                          <td style={{ padding: 10 }}><i className="ti ti-eye" style={{ fontSize: 16, color: 'var(--text-muted)', cursor: 'pointer' }} /></td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  )
}
