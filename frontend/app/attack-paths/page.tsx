'use client'
import { useEffect, useState } from 'react'
import { PageLayout }    from '@/components/PageLayout'
import { AttackPathCard } from '@/components/AttackPathCard'
import { requestJson } from '@/lib/api'

export default function AttackPathsPage() {
  const [paths,  setPaths]  = useState<any[]>([])
  const [loading,setLoading]= useState(true)
  const [filter, setFilter] = useState<string>('ALL')

  useEffect(() => {
    let cancelled = false

    requestJson('/dashboard/me').then((d: any) => {
      if (cancelled) return
      setPaths(d?.attack_paths || [])
      setLoading(false)
    }).catch(() => {
      if (!cancelled) setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [])

  const FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  const filtered = filter === 'ALL' ? paths : paths.filter(p => p.exploitability === filter)

  const counts = FILTERS.slice(1).reduce((acc, f) => ({
    ...acc, [f]: paths.filter(p => p.exploitability === f).length
  }), {} as Record<string,number>)

  const badgeCol: Record<string,string> = {
    CRITICAL:'var(--aws-risk)', HIGH:'var(--aws-orange)', MEDIUM:'var(--aws-blue)', LOW:'var(--aws-storage)'
  }

  return (
    <PageLayout title="Attack Paths" subtitle="All detected multi-hop attack chains ranked by exploitability">

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', fontSize: 11, borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${filter===f ? (badgeCol[f]||'var(--aws-blue)') : '#1a2d45'}`,
            background: filter===f ? (f==='ALL'?'#1565c0':'#0f1a2a') : 'transparent',
            color: filter===f ? (badgeCol[f]||'#fff') : '#607d8b',
            fontWeight: filter===f ? 500 : 400,
          }}>
            {f} {f!=='ALL' && counts[f] !== undefined && (
              <span style={{ marginLeft: 4, background: '#1a2d45', borderRadius: 4, padding: '1px 6px' }}>
                {counts[f]}
              </span>
            )}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#455a64', alignSelf: 'center' }}>
          {filtered.length} paths shown
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
        {(['CRITICAL','HIGH','MEDIUM','LOW'] as const).map(sev => (
          <div key={sev} style={{ background: '#0a1929', border: `1px solid #1a2d45`, borderTop: `3px solid ${badgeCol[sev]}`, borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#455a64', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 6 }}>{sev}</div>
            <div style={{ fontSize: 28, fontWeight: 500, color: badgeCol[sev] }}>{counts[sev] ?? 0}</div>
            <div style={{ fontSize: 10, color: '#37637a', marginTop: 4 }}>attack paths</div>
          </div>
        ))}
      </div>

      {/* Path list */}
      {loading && <div style={{ color: '#37637a', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>Loading scan results...</div>}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <i className="ti ti-shield-check" style={{ fontSize: 40, color: 'var(--aws-storage)', display: 'block', marginBottom: 12 }} />
          <div style={{ color: 'var(--aws-storage)', fontSize: 14 }}>No {filter !== 'ALL' ? filter : ''} attack paths found</div>
          <div style={{ color: '#455a64', fontSize: 12, marginTop: 4 }}>Run a scan from the Dashboard to refresh results</div>
        </div>
      )}
      <div style={{ maxWidth: 900 }}>
        {filtered.map((path, i) => <AttackPathCard key={i} path={path} />)}
      </div>
    </PageLayout>
  )
}
