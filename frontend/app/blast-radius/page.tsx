'use client'
import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/PageLayout'
import { useScan } from '@/context/ScanContext'
import { requestJson } from '@/lib/api'

export default function BlastRadiusPage() {
  const { results } = useScan()
  const [paths,   setPaths]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    if (results?.attack_paths) {
      setPaths(results.attack_paths)
      setLoading(false)
      return
    }

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
  }, [results])


  const sorted = [...paths].sort((a, b) => (b.blast_radius||0) - (a.blast_radius||0))

  const getColor = (score: number) =>
    score > 70 ? 'var(--aws-risk)' : score > 40 ? 'var(--aws-orange)' : 'var(--aws-storage)'

  const getLabel = (score: number) =>
    score > 70 ? 'Critical' : score > 40 ? 'High' : 'Moderate'

  return (
    <PageLayout title="Blast Radius" subtitle="Post-exploitation damage assessment per attack path target">

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Max Blast Radius', value: paths.length ? `${Math.max(...paths.map(p=>p.blast_radius??0)).toFixed(0)}%` : '—', color: 'var(--aws-risk)' },
          { label: 'Avg Blast Radius', value: paths.length ? `${(paths.reduce((s,p)=>s+(p.blast_radius??0),0)/paths.length).toFixed(0)}%` : '—', color: 'var(--aws-orange)' },
          { label: 'Paths Analysed',   value: paths.length, color: 'var(--aws-blue)' },
        ].map(c => (
          <div key={c.label} style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 10, color: '#455a64', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 32, fontWeight: 500, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {loading && <div style={{ color: '#37637a', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>Loading...</div>}

      {/* Per-path blast radius cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.map((path, i) => {
          const br    = path.blast_radius ?? 0
          const color = getColor(br)
          return (
            <div key={i} style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(209, 50, 18, .14)', color: 'var(--aws-risk)', fontWeight: 500 }}>
                      {path.exploitability}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#e1f5fe' }}>→ {path.target_name}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#455a64' }}>
                    {path.hop_count} steps · Score {path.score?.toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 32, fontWeight: 500, color, lineHeight: 1 }}>{br.toFixed(0)}</div>
                  <div style={{ fontSize: 10, color: '#455a64' }}>/ 100</div>
                  <div style={{ fontSize: 11, color, marginTop: 2 }}>{getLabel(br)}</div>
                </div>
              </div>

              {/* Progress bar */}
              <div style={{ height: 8, background: '#0f2236', borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  width: `${Math.min(br, 100)}%`,
                  background: color,
                  transition: 'width .6s ease',
                }} />
              </div>

              {/* Hop chain */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {path.hops?.map((h: any, hi: number) => (
                  <span key={hi} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', background: '#0f2236', color: '#90caf9', borderRadius: 4 }}>
                      {h.source_name}
                    </span>
                    <i className="ti ti-arrow-right" style={{ fontSize: 10, color: '#37637a' }} />
                    {hi === path.hops.length - 1 && (
                      <span style={{ fontSize: 10, padding: '2px 8px', background: '#1a0a0a', color: color, borderRadius: 4 }}>
                        {h.target_name}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
        {!loading && sorted.length === 0 && (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <i className="ti ti-ripple" style={{ fontSize: 40, color: '#37637a', display: 'block', marginBottom: 12 }} />
            <div style={{ color: '#455a64', fontSize: 13 }}>No blast radius data yet. Run a scan from the Dashboard.</div>
          </div>
        )}
      </div>
    </PageLayout>
  )
}
