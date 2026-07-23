'use client'
import { useEffect, useState } from 'react'
import { PageLayout }    from '@/components/PageLayout'
import { AttackPathCard } from '@/components/AttackPathCard'
import { SecurityGraph }  from '@/components/SecurityGraph'
import { useScan }        from '@/context/ScanContext'

export default function AttackPathsPage() {
  const { results, loaded } = useScan()
  const [paths,  setPaths]  = useState<any[]>([])
  const [loading,setLoading]= useState(true)
  const [filter, setFilter] = useState<string>('ALL')
  const [selectedIndex, setSelectedIndex] = useState<number>(0)

  useEffect(() => {
    if (results) {
      setPaths(results.attack_paths || [])
      setLoading(false)
    } else if (loaded) {
      setLoading(false)
    }
  }, [results, loaded])

  const FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  const filtered = filter === 'ALL' ? paths : paths.filter(p => p.exploitability === filter)

  const counts = FILTERS.slice(1).reduce((acc, f) => ({
    ...acc, [f]: paths.filter(p => p.exploitability === f).length
  }), {} as Record<string,number>)

  const badgeCol: Record<string,string> = {
    CRITICAL:'var(--aws-risk)', HIGH:'var(--aws-orange)', MEDIUM:'var(--aws-blue)', LOW:'var(--aws-storage)'
  }

  const selectedPath = filtered[selectedIndex] || filtered[0] || null

  return (
    <PageLayout title="Attack Paths" subtitle="All detected multi-hop attack chains ranked by exploitability">

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => { setFilter(f); setSelectedIndex(0) }} style={{
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

      {/* Main Content: Split View with Interactive Cards + Highlighted Path Graph */}
      {loading && <div style={{ color: '#37637a', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>Loading scan results...</div>}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <i className="ti ti-shield-check" style={{ fontSize: 40, color: 'var(--aws-storage)', display: 'block', marginBottom: 12 }} />
          <div style={{ color: 'var(--aws-storage)', fontSize: 14 }}>No {filter !== 'ALL' ? filter : ''} attack paths found</div>
          <div style={{ color: '#455a64', fontSize: 12, marginTop: 4 }}>Run a scan from the Dashboard to refresh results</div>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: 20, alignItems: 'start' }}>
          {/* Path list */}
          <div>
            {filtered.map((path, i) => (
              <AttackPathCard
                key={i}
                path={path}
                isSelected={selectedIndex === i}
                onSelect={() => setSelectedIndex(i)}
              />
            ))}
          </div>

          {/* Highlighted Path Visualizer Panel */}
          <div
            style={{
              position: 'sticky',
              top: 20,
              background: '#07121a',
              border: '1px solid #1a2d45',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="ti ti-route" style={{ color: 'var(--orange)' }} />
                  Highlighted Attack Path
                </div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                  {selectedPath ? `Target: ${selectedPath.target_name || selectedPath.target_id}` : 'Select a path to highlight'}
                </div>
              </div>
              {selectedPath && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 999,
                    background: selectedPath.exploitability === 'CRITICAL' ? 'rgba(209, 50, 18, 0.2)' : 'rgba(255, 153, 0, 0.2)',
                    color: selectedPath.exploitability === 'CRITICAL' ? 'var(--red)' : 'var(--orange)'
                  }}
                >
                  {selectedPath.exploitability}
                </span>
              )}
            </div>

            {/* Cytoscape Graph Canvas */}
            <div style={{ height: 360, width: '100%', borderRadius: 8, background: '#0a1929', border: '1px solid #1e293b', overflow: 'hidden' }}>
              {results?.graph_data && selectedPath ? (
                <SecurityGraph data={results.graph_data} attackPaths={[selectedPath]} isolatePath={true} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: 12 }}>
                  No graph data available
                </div>
              )}
            </div>


            {/* Path Summary Stats */}
            {selectedPath && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: '#0a1929', padding: 10, borderRadius: 8, border: '1px solid #1e293b' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Hops</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0' }}>{selectedPath.hop_count}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Risk Score</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--orange)' }}>{selectedPath.score?.toFixed(0)}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>Blast Radius</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)' }}>{selectedPath.blast_radius?.toFixed(0)}%</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  )
}

