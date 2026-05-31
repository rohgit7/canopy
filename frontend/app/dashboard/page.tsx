'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import { SecurityGraph }  from '@/components/SecurityGraph'
import { AttackPathCard } from '@/components/AttackPathCard'

const API = process.env.NEXT_PUBLIC_API_URL

const NAV_ITEMS = [
  { icon: 'ti-layout-dashboard', label: 'Dashboard',    active: true  },
  { icon: 'ti-route',            label: 'Attack Paths', active: false },
  { icon: 'ti-cloud',            label: 'Resources',    active: false },
  { icon: 'ti-key',              label: 'IAM Analyzer', active: false },
  { icon: 'ti-ripple',           label: 'Blast Radius', active: false },
  { icon: 'ti-report-analytics', label: 'AI Reports',   active: false },
  { icon: 'ti-plug',             label: 'Integrations', active: false },
  { icon: 'ti-settings',         label: 'Settings',     active: false },
]

export default function Dashboard() {
  const { getToken }                      = useAuth()
  const [scanId,   setScanId]             = useState<string | null>(null)
  const [scanning, setScanning]           = useState(false)
  const [results,  setResults]            = useState<any>(null)
  const [progress, setProgress]           = useState('')
  const [error,    setError]              = useState<string | null>(null)
  const [activeNav, setActiveNav]         = useState('Dashboard')

  const scan = async () => {
    setScanning(true); setError(null); setResults(null)
    setProgress('Connecting to your AWS account...')
    try {
      const token = await getToken()
      const r     = await fetch(`${API}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
    const msgInt  = setInterval(() => setProgress(msgs[idx++ % msgs.length]), 8000)
    const pollInt = setInterval(async () => {
      try {
        const r    = await fetch(`${API}/scan/${scanId}`)
        const data = await r.json()
        if (data.status === 'complete') {
          setResults(data); setScanning(false)
          clearInterval(msgInt); clearInterval(pollInt)
        } else if (data.status === 'failed') {
          setError(data.error || 'Scan failed'); setScanning(false)
          clearInterval(msgInt); clearInterval(pollInt)
        }
      } catch { /* keep polling */ }
    }, 3000)
    return () => { clearInterval(msgInt); clearInterval(pollInt) }
  }, [scanId, scanning])

  const score = results?.score ?? null

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#07111f', color: '#b0bec5', fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 200, background: '#0a1929', borderRight: '1px solid #1a2d45', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #1a2d45' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-shield-lock" style={{ fontSize: 20, color: '#4fc3f7' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#4fc3f7', letterSpacing: '.5px' }}>CANOPY</div>
              <div style={{ fontSize: 10, color: '#37637a', letterSpacing: '1px', textTransform: 'uppercase', marginTop: 2 }}>AWS Security Platform</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {NAV_ITEMS.map(item => (
            <div
              key={item.label}
              onClick={() => setActiveNav(item.label)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 16px', fontSize: 12, cursor: 'pointer',
                color: activeNav === item.label ? '#4fc3f7' : '#607d8b',
                background: activeNav === item.label ? '#0f2236' : 'transparent',
                borderLeft: activeNav === item.label ? '2px solid #4fc3f7' : '2px solid transparent',
                transition: 'all .15s',
              }}
            >
              <i className={`ti ${item.icon}`} style={{ fontSize: 16 }} />
              {item.label}
            </div>
          ))}
        </nav>

        <button
          onClick={scan}
          disabled={scanning}
          style={{
            margin: '0 12px 12px', padding: '10px',
            background: scanning ? '#0f2236' : '#1565c0',
            color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 12, fontWeight: 500, cursor: scanning ? 'not-allowed' : 'pointer', letterSpacing: '.3px',
          }}
        >
          <i className="ti ti-player-play" style={{ fontSize: 12, verticalAlign: -1, marginRight: 4 }} />
          {scanning ? 'SCANNING...' : 'START SCAN'}
        </button>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #1a2d45', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[['ti-file-description','Docs'],['ti-logout','Logout']].map(([icon, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#455a64', cursor: 'pointer' }}>
              <i className={`ti ${icon}`} style={{ fontSize: 14 }} />{label}
            </div>
          ))}
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid #1a2d45', background: '#0a1929', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#90caf9', background: '#0f2236', border: '1px solid #1a2d45', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>
            <i className="ti ti-server" style={{ fontSize: 14 }} />AWS-PROD-AP-SOUTH-1
            <i className="ti ti-chevron-down" style={{ fontSize: 13 }} />
          </div>
          {scanning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4caf50' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4caf50', animation: 'pulse 1.5s infinite' }} />
              {progress}
            </div>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0f2236', border: '1px solid #1a2d45', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#455a64' }}>
              <i className="ti ti-search" style={{ fontSize: 15 }} />Search threats, assets...
            </div>
            <i className="ti ti-bell" style={{ fontSize: 18, color: '#37637a', cursor: 'pointer' }} />
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 20px', flex: 1 }}>

          {/* Error */}
          {error && (
            <div style={{ background: '#1a0a0a', border: '1px solid #2a1010', borderRadius: 8, padding: '12px 16px', marginBottom: 14, color: '#ef5350', fontSize: 12 }}>
              <i className="ti ti-alert-triangle" style={{ marginRight: 6 }} />{error}
            </div>
          )}

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'AWS Resources', icon: 'ti-server',  value: results?.resource_count ?? '—',  sub: results ? `${results.node_count} nodes` : 'Run a scan',       subColor: '#4caf50' },
              { label: 'Critical Chains',icon: 'ti-link',   value: results?.attack_paths?.filter((p:any)=>p.exploitability==='CRITICAL').length ?? '—', sub: results ? 'Active paths' : 'Run a scan', subColor: '#ff9800' },
              { label: 'Attack Paths',  icon: 'ti-route',   value: results?.attack_paths?.length ?? '—', sub: results ? 'Total found' : 'Run a scan',                  subColor: '#ff9800' },
              { label: 'Graph Edges',   icon: 'ti-arrows-split-2', value: results?.edge_count ?? '—', sub: results ? 'Relationships' : 'Run a scan',                   subColor: '#4fc3f7' },
              { label: 'Risk Score',    icon: 'ti-gauge',   value: score !== null ? `${score.toFixed(0)}` : '—', sub: score !== null ? (score >= 80 ? 'Low risk' : score >= 50 ? 'Medium risk' : 'High risk') : 'Run a scan', subColor: score !== null ? (score >= 80 ? '#4caf50' : score >= 50 ? '#ff9800' : '#ef5350') : '#455a64' },
              { label: 'Scan Time',     icon: 'ti-clock',   value: scanning ? 'Live' : (results ? new Date(results.completed_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : '—'), sub: scanning ? 'In progress' : 'Last scan', subColor: '#455a64' },
            ].map(card => (
              <div key={card.label} style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 12 }}>
                <div style={{ fontSize: 10, color: '#455a64', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  {card.label}<i className={`ti ${card.icon}`} style={{ fontSize: 14, color: '#37637a' }} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 500, color: '#e1f5fe', lineHeight: 1 }}>{card.value}</div>
                <div style={{ fontSize: 10, marginTop: 4, color: card.subColor }}>{card.sub}</div>
              </div>
            ))}
          </div>

          {/* Middle row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 12, marginBottom: 14 }}>

            {/* Attack path cards */}
            <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 14, maxHeight: 320, overflow: 'auto' }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#607d8b', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
                Attack Paths {results && `(${results.attack_paths?.length ?? 0})`}
              </div>
              {!results && <div style={{ fontSize: 12, color: '#455a64', textAlign: 'center', paddingTop: 40 }}>Run a scan to see attack paths</div>}
              {results?.attack_paths?.length === 0 && <div style={{ fontSize: 12, color: '#4caf50', textAlign: 'center', paddingTop: 40 }}>No attack paths found</div>}
              {results?.attack_paths?.map((path: any, i: number) => (
                <AttackPathCard key={i} path={path} />
              ))}
            </div>

            {/* Graph */}
            <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 14, height: 320 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#607d8b', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 8 }}>Resource Graph</div>
              {results?.graph_data
                ? <SecurityGraph data={results.graph_data} attackPaths={results.attack_paths} />
                : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '85%', color: '#37637a', fontSize: 12 }}>
                    <i className="ti ti-topology-star-3" style={{ fontSize: 32, display: 'block', textAlign: 'center', marginBottom: 8 }} />
                  </div>
              }
            </div>
          </div>

          {/* Scan history table */}
          <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#607d8b', textTransform: 'uppercase', letterSpacing: '.7px' }}>Recent Compliance Scans</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['ti-download','Export CSV',false],['ti-calendar','Schedule Scan',true]].map(([icon,label,primary]) => (
                  <button key={label as string} style={{ fontSize: 10, padding: '5px 12px', borderRadius: 6, border: `1px solid ${primary ? '#1565c0' : '#1a2d45'}`, color: primary ? '#fff' : '#607d8b', background: primary ? '#1565c0' : 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <i className={`ti ${icon}`} style={{ fontSize: 12 }} />{label}
                  </button>
                ))}
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>{['Scan ID','Target Environment','Status','Completed','Findings','Action'].map(h => (
                  <th key={h} style={{ fontSize: 10, color: '#37637a', textTransform: 'uppercase', letterSpacing: '.7px', padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #1a2d45' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {results
                  ? <tr>
                      <td style={{ fontSize: 10, fontFamily: 'monospace', color: '#4fc3f7', padding: '8px', borderBottom: '1px solid #0d1e2f' }}>SCN-{Math.floor(Math.random()*9000+1000)}</td>
                      <td style={{ fontSize: 11, color: '#b0bec5', padding: 8, borderBottom: '1px solid #0d1e2f' }}>Production — AP South</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #0d1e2f' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#071a0f', color: '#4caf50' }}><i className="ti ti-circle-check" style={{ fontSize: 11 }} />Completed</span></td>
                      <td style={{ fontSize: 11, color: '#455a64', padding: 8, borderBottom: '1px solid #0d1e2f' }}>{new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</td>
                      <td style={{ padding: 8, borderBottom: '1px solid #0d1e2f' }}>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {[['CRIT',results.attack_paths?.filter((p:any)=>p.exploitability==='CRITICAL').length??0,'#1a0a0a','#ef5350'],['HIGH',results.attack_paths?.filter((p:any)=>p.exploitability==='HIGH').length??0,'#1a1000','#ff9800'],['MED',results.attack_paths?.filter((p:any)=>p.exploitability==='MEDIUM').length??0,'#071929','#4fc3f7']].map(([l,v,bg,col])=>(
                            <span key={l as string} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, fontWeight: 500, background: bg as string, color: col as string }}>{l}: {v}</span>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: 8, borderBottom: '1px solid #0d1e2f' }}><i className="ti ti-eye" style={{ fontSize: 15, color: '#37637a', cursor: 'pointer' }} /></td>
                    </tr>
                  : [['SCN-4421','Production Cluster','ok','Oct 24, 2023','12','43','88'],['SCN-4420','Staging Environment','ok','Oct 23, 2023','3','17','42']].map(row => (
                      <tr key={row[0]}>
                        <td style={{ fontSize: 10, fontFamily: 'monospace', color: '#4fc3f7', padding: '8px', borderBottom: '1px solid #0d1e2f' }}>{row[0]}</td>
                        <td style={{ fontSize: 11, color: '#b0bec5', padding: 8, borderBottom: '1px solid #0d1e2f' }}>{row[1]}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #0d1e2f' }}><span style={{ display:'inline-flex',alignItems:'center',gap:4,fontSize:10,padding:'2px 8px',borderRadius:4,background:'#071a0f',color:'#4caf50' }}><i className="ti ti-circle-check" style={{fontSize:11}} />Completed</span></td>
                        <td style={{ fontSize: 11, color: '#455a64', padding: 8, borderBottom: '1px solid #0d1e2f' }}>{row[3]}</td>
                        <td style={{ padding: 8, borderBottom: '1px solid #0d1e2f' }}><div style={{display:'flex',gap:3}}><span style={{fontSize:10,padding:'2px 7px',borderRadius:4,background:'#1a0a0a',color:'#ef5350'}}>{row[4]}</span><span style={{fontSize:10,padding:'2px 7px',borderRadius:4,background:'#1a1000',color:'#ff9800'}}>{row[5]}</span><span style={{fontSize:10,padding:'2px 7px',borderRadius:4,background:'#071929',color:'#4fc3f7'}}>{row[6]}</span></div></td>
                        <td style={{ padding: 8, borderBottom: '1px solid #0d1e2f' }}><i className="ti ti-eye" style={{fontSize:15,color:'#37637a',cursor:'pointer'}} /></td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

        </div>
      </div>

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
    </div>
  )
}