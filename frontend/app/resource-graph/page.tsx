'use client'
import { useEffect, useState, useRef } from 'react'
import { PageLayout } from '@/components/PageLayout'
import { useScan } from '@/context/ScanContext'
import cytoscape from 'cytoscape'
import { requestJson } from '@/lib/api'

// ── Colour + metadata maps ────────────────────────────────────────────────────
const NODE_TYPES: Record<string, { color: string; border: string; icon: string; label: string; desc: string }> = {
  'ec2:instance':       { color: '#1d4ed8', border: '#3b82f6', icon: '⬡', label: 'EC2 Instance',    desc: 'Virtual server running in AWS' },
  'ec2:security_group': { color: '#374151', border: '#6b7280', icon: '⬡', label: 'Security Group',  desc: 'Firewall rules controlling network access' },
  's3:bucket':          { color: '#92400e', border: '#f59e0b', icon: '⬡', label: 'S3 Bucket',       desc: 'Object storage — files and data' },
  'iam:role':           { color: '#4c1d95', border: '#8b5cf6', icon: '⬡', label: 'IAM Role',        desc: 'AWS identity with permission policies' },
  'iam:user':           { color: '#3b0764', border: '#a78bfa', icon: '⬡', label: 'IAM User',        desc: 'Human or service account identity' },
  'lambda:function':    { color: '#7c2d12', border: '#f97316', icon: '⬡', label: 'Lambda Function', desc: 'Serverless code execution environment' },
  'pseudo:internet':    { color: '#7f1d1d', border: '#ef4444', icon: '⬡', label: 'Internet',        desc: 'Attacker entry point — public internet' },
}

const EDGE_TYPES: Record<string, { color: string; label: string; weight: number; desc: string; risk: string }> = {
  'EXPOSES_PORT':  { color: '#ef4444', label: 'Exposes Port',        weight: 0.1, desc: 'Resource reachable from the internet via open port', risk: 'CRITICAL' },
  'HAS_ROLE':      { color: '#f97316', label: 'Has IAM Role',        weight: 0.2, desc: 'EC2/Lambda runs with this IAM role (metadata endpoint)', risk: 'HIGH' },
  'CAN_ASSUME':    { color: '#eab308', label: 'Can Assume Role',     weight: 0.2, desc: 'Role can call sts:AssumeRole on the target role', risk: 'HIGH' },
  'CAN_ACCESS':    { color: '#4fc3f7', label: 'Can Access',          weight: 0.3, desc: 'IAM policy allows this role to perform actions on target', risk: 'MEDIUM' },
  'HAS_ENV_CREDS': { color: '#a78bfa', label: 'Has Env Credentials', weight: 0.1, desc: 'Sensitive credentials found in environment variables', risk: 'CRITICAL' },
  'ATTACHED_SG':   { color: '#6b7280', label: 'Attached SG',         weight: 0.0, desc: 'Security group attached to this resource', risk: 'INFO' },
}

const RISK_COLORS: Record<string, string> = {
  CRITICAL: '#ef5350',
  HIGH:     '#ff9800',
  MEDIUM:   '#4fc3f7',
  INFO:     '#607d8b',
}

// ── Tooltip component ─────────────────────────────────────────────────────────
function Tooltip({ x, y, data, onClose }: { x: number; y: number; data: any; onClose: () => void }) {
  const isNode = data.kind === 'node'
  const nodeDef = isNode ? NODE_TYPES[data.type as string] : undefined
  const edgeDef = !isNode ? EDGE_TYPES[data.edge_type as string] : undefined
  const borderColor = isNode ? nodeDef?.border : edgeDef?.color
  const primaryColor = isNode ? nodeDef?.color : edgeDef?.color

  return (
    <div style={{
      position: 'absolute', left: x + 12, top: y - 8,
      background: '#0a1929', border: `1px solid ${borderColor || primaryColor || '#1a2d45'}`,
      borderRadius: 8, padding: 14, minWidth: 220, maxWidth: 300,
      zIndex: 1000, pointerEvents: 'none',
      boxShadow: `0 0 20px ${borderColor || primaryColor || '#1a2d45'}33`,
    }}>
      {isNode ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: nodeDef?.border || '#607d8b' }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: '#e1f5fe' }}>{data.name || data.id}</span>
          </div>
          <div style={{ fontSize: 10, color: '#37637a', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 6 }}>
            {(nodeDef as any)?.label || data.type}
          </div>
          <div style={{ fontSize: 11, color: '#607d8b', lineHeight: 1.5, marginBottom: 10 }}>
            {(nodeDef as any)?.desc || ''}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {data.internet_facing && (
              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#1a0a0a', color: '#ef5350' }}>INTERNET-FACING</span>
            )}
            {data.is_sensitive && (
              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#1a0a0a', color: '#ef5350' }}>SENSITIVE</span>
            )}
            {data.is_admin && (
              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#1a0000', color: '#ff1744' }}>ADMIN</span>
            )}
          </div>
          {data.region && data.region !== 'global' && (
            <div style={{ fontSize: 10, color: '#37637a', marginTop: 8 }}>Region: {data.region}</div>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 24, height: 2, background: edgeDef?.color || '#607d8b' }} />
            <span style={{ fontSize: 12, fontWeight: 500, color: '#e1f5fe' }}>{(edgeDef as any)?.label || data.edge_type}</span>
          </div>
          <div style={{ fontSize: 11, color: '#607d8b', lineHeight: 1.5, marginBottom: 10 }}>
            {(edgeDef as any)?.desc || ''}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: '#0f2236', color: '#37637a' }}>
              DIFFICULTY: {data.weight}
            </span>
            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3,
              background: '#0f1a2a',
              color: RISK_COLORS[(edgeDef as any)?.risk || 'INFO'],
            }}>
              {(edgeDef as any)?.risk || 'INFO'}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ResourceGraphPage() {
  const cyRef      = useRef<HTMLDivElement>(null)
  const cy         = useRef<any>(null)
  const { results, loaded } = useScan()
  const [graphData, setGraphData]   = useState<any>(null)
  const [paths,     setPaths]       = useState<any[]>([])
  const [loading,   setLoading]     = useState(true)
  const [tooltip,   setTooltip]     = useState<any>(null)
  const [selected,  setSelected]    = useState<any>(null)
  const [layout,    setLayout]      = useState('cose')
  const [showEdgeLabels, setShowEdgeLabels] = useState(false)
  const [filterType, setFilterType] = useState<string | null>(null)
  const [highlightPath, setHighlightPath] = useState<number | null>(null)
  const [stats,     setStats]       = useState({ nodes: 0, edges: 0, internet: 0, sensitive: 0, admin: 0 })

  // Fetch data
  useEffect(() => {
    if (results) {
      setGraphData(results.graph_data || null)
      setPaths(results.attack_paths || [])
      const nodes = results.graph_data?.nodes || []
      setStats({
        nodes:     nodes.length,
        edges:     results.graph_data?.links?.length || 0,
        internet:  nodes.filter((n: any) => n.internet_facing).length,
        sensitive: nodes.filter((n: any) => n.is_sensitive).length,
        admin:     nodes.filter((n: any) => n.is_admin).length,
      })
      setLoading(false)
    } else if (loaded) {
      setLoading(false)
    }
  }, [results, loaded])



  // Build Cytoscape
  useEffect(() => {
    if (!cyRef.current || !graphData) return
    if (cy.current) cy.current.destroy()

    const filteredNodes = filterType
      ? graphData.nodes.filter((n: any) => n.type === filterType || n.type === 'pseudo:internet')
      : graphData.nodes

    const filteredNodeIds = new Set(filteredNodes.map((n: any) => n.id))
    const filteredLinks   = graphData.links.filter((e: any) =>
      filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    )

    cy.current = cytoscape({
      container: cyRef.current,
      elements: [
        ...filteredNodes.map((n: any) => ({
          data: {
            id:             String(n.id),
            label:          (n.name || n.id).substring(0, 18),
            type:           n.type,
            name:           n.name,
            region:         n.region,
            internet_facing:n.internet_facing,
            is_sensitive:   n.is_sensitive,
            is_admin:       n.is_admin,
            kind:           'node',
          },
        })),
        ...filteredLinks.map((e: any, i: number) => ({
          data: {
            id:         `e${i}`,
            source:     String(e.source),
            target:     String(e.target),
            edge_type:  e.edge_type || '',
            weight:     e.weight || 0.5,
            kind:       'edge',
            label:      showEdgeLabels ? (EDGE_TYPES[e.edge_type]?.label || e.edge_type) : '',
          },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (n: any) => {
              const def = NODE_TYPES[n.data('type')]
              return def?.color || '#1a2d45'
            },
            'border-color': (n: any) => {
              if (n.data('is_admin'))       return '#ff1744'
              if (n.data('is_sensitive'))   return '#ef5350'
              if (n.data('internet_facing'))return '#f97316'
              return NODE_TYPES[n.data('type')]?.border || '#37637a'
            },
            'border-width': (n: any) =>
              n.data('is_admin') || n.data('is_sensitive') || n.data('internet_facing') ? 3 : 1.5,
            label:           'data(label)',
            color:           '#94a3b8',
            'font-size':     '10px',
            'font-family':   'monospace',
            'text-valign':   'bottom',
            'text-halign':   'center',
            'text-margin-y': 4,
            'text-wrap':     'wrap',
            'text-max-width':'80px',
            width: (n: any) => {
              if (n.data('type') === 'pseudo:internet') return 48
              if (n.data('is_admin') || n.data('is_sensitive')) return 38
              if (n.data('internet_facing')) return 34
              return 26
            },
            height: (n: any) => {
              if (n.data('type') === 'pseudo:internet') return 48
              if (n.data('is_admin') || n.data('is_sensitive')) return 38
              if (n.data('internet_facing')) return 34
              return 26
            },
          } as any,
        },
        {
          selector: 'edge',
          style: {
            width: (e: any) => Math.max(1, 3.5 - (e.data('weight') || 0.5) * 3),
            'line-color':         (e: any) => EDGE_TYPES[e.data('edge_type')]?.color || '#1e3a5f',
            'target-arrow-color': (e: any) => EDGE_TYPES[e.data('edge_type')]?.color || '#1e3a5f',
            'target-arrow-shape': 'triangle',
            'curve-style':        'bezier',
            'label':              'data(label)',
            'font-size':          '8px',
            'color':              '#455a64',
            'text-rotation':      'autorotate',
            'font-family':        'monospace',
          } as any,
        },
        {
          selector: '.attack-edge',
          style: {
            'line-color':         '#ef4444',
            'target-arrow-color': '#ef4444',
            width:                4,
            'z-index':            999,
          },
        },
        {
          selector: '.attack-node',
          style: {
            'border-color': '#ef4444',
            'border-width': 4,
            'z-index':      999,
          },
        },
        {
          selector: '.dimmed',
          style: {
            opacity: 0.15,
          },
        },
        {
          selector: '.highlighted',
          style: {
            opacity: 1,
          },
        },
      ],
      layout: {
        name: layout,
        animate: false,
        randomize: false,
        numIter: 150,
        idealEdgeLength: 100,
        nodeRepulsion: 8000,
        padding: 40,
        stop: () => {
          // Highlight attack path if selected
          if (highlightPath !== null && paths[highlightPath]) {
            applyPathHighlight(paths[highlightPath])
          }
        },
      } as any,

    })

    // Tooltip on hover
    cy.current.on('mouseover', 'node', (evt: any) => {
      const n    = evt.target
      const pos  = evt.renderedPosition
      setTooltip({
        x: pos.x, y: pos.y,
        data: { ...n.data(), kind: 'node' },
      })
    })
    cy.current.on('mouseout', 'node', () => setTooltip(null))

    cy.current.on('mouseover', 'edge', (evt: any) => {
      const e   = evt.target
      const pos = evt.renderedPosition
      setTooltip({
        x: pos.x, y: pos.y,
        data: { ...e.data(), kind: 'edge' },
      })
    })
    cy.current.on('mouseout', 'edge', () => setTooltip(null))

    // Select on click
    cy.current.on('tap', 'node', (evt: any) => {
      const n = evt.target
      setSelected({ kind: 'node', ...n.data() })
    })
    cy.current.on('tap', 'edge', (evt: any) => {
      const e = evt.target
      setSelected({ kind: 'edge', ...e.data() })
    })
    cy.current.on('tap', (evt: any) => {
      if (evt.target === cy.current) setSelected(null)
    })

  }, [graphData, layout, filterType, showEdgeLabels])

  // Apply path highlight
  const applyPathHighlight = (path: any) => {
    if (!cy.current || !path) return
    cy.current.elements().removeClass('attack-edge attack-node dimmed highlighted')

    const pathNodeIds = new Set<string>()
    path.hops?.forEach((h: any) => {
      pathNodeIds.add(String(h.source_id))
      pathNodeIds.add(String(h.target_id))
    })

    cy.current.elements().addClass('dimmed')
    path.hops?.forEach((h: any) => {
      const src = String(h.source_id), tgt = String(h.target_id)
      cy.current.edges().filter((e: any) =>
        String(e.data('source')) === src && String(e.data('target')) === tgt
      ).removeClass('dimmed').addClass('attack-edge highlighted')
    })
    pathNodeIds.forEach(id => {
      cy.current.getElementById(id).removeClass('dimmed').addClass('attack-node highlighted')
    })
  }

  const clearHighlight = () => {
    setHighlightPath(null)
    cy.current?.elements().removeClass('attack-edge attack-node dimmed highlighted')
  }

  const handlePathHighlight = (i: number) => {
    if (highlightPath === i) { clearHighlight(); return }
    setHighlightPath(i)
    applyPathHighlight(paths[i])
  }

  const resetLayout = () => {
    cy.current?.layout({ name: layout, animate: true, idealEdgeLength: 100, nodeRepulsion: 8000, padding: 40 }).run()
  }

  const fitGraph = () => cy.current?.fit(undefined, 40)

  const zoomIn  = () => cy.current?.zoom({ level: cy.current.zoom() * 1.3, renderedPosition: { x: cyRef.current!.clientWidth / 2, y: cyRef.current!.clientHeight / 2 } })
  const zoomOut = () => cy.current?.zoom({ level: cy.current.zoom() * 0.7, renderedPosition: { x: cyRef.current!.clientWidth / 2, y: cyRef.current!.clientHeight / 2 } })

  return (
    <PageLayout title="Resource Graph" subtitle="Interactive topology of your AWS account — hover nodes and edges for details">
      <div style={{ display: 'flex', gap: 14, height: 'calc(100vh - 180px)' }}>

        {/* ── Left panel: controls ── */}
        <div style={{ width: 240, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0, overflow: 'auto' }}>

          {/* Stats */}
          <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#37637a', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>Graph Stats</div>
            {[
              { label: 'Total Nodes',      value: stats.nodes,     color: '#4fc3f7' },
              { label: 'Total Edges',      value: stats.edges,     color: '#607d8b' },
              { label: 'Internet-Facing',  value: stats.internet,  color: '#f97316' },
              { label: 'Sensitive Assets', value: stats.sensitive, color: '#ef5350' },
              { label: 'Admin Roles',      value: stats.admin,     color: '#ff1744' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #0d1e2f', fontSize: 11 }}>
                <span style={{ color: '#455a64' }}>{s.label}</span>
                <span style={{ color: s.color, fontWeight: 500 }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Layout */}
          <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#37637a', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>Layout</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { id: 'cose',        label: 'Force-Directed' },
                { id: 'circle',      label: 'Circle'         },
                { id: 'grid',        label: 'Grid'           },
                { id: 'breadthfirst',label: 'Hierarchy'      },
              ].map(l => (
                <button key={l.id} onClick={() => setLayout(l.id)} style={{
                  padding: '6px 10px', background: layout===l.id ? '#1565c0' : 'transparent',
                  border: `1px solid ${layout===l.id ? '#1565c0' : '#1a2d45'}`,
                  borderRadius: 6, color: layout===l.id ? '#fff' : '#607d8b',
                  fontSize: 11, cursor: 'pointer', textAlign: 'left',
                }}>
                  {l.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              <button onClick={fitGraph} style={{ flex: 1, padding: '5px', background: '#0f2236', border: '1px solid #1a2d45', borderRadius: 6, color: '#607d8b', fontSize: 10, cursor: 'pointer' }}>
                Fit
              </button>
              <button onClick={zoomIn}  style={{ flex: 1, padding: '5px', background: '#0f2236', border: '1px solid #1a2d45', borderRadius: 6, color: '#607d8b', fontSize: 10, cursor: 'pointer' }}>
                Zoom +
              </button>
              <button onClick={zoomOut} style={{ flex: 1, padding: '5px', background: '#0f2236', border: '1px solid #1a2d45', borderRadius: 6, color: '#607d8b', fontSize: 10, cursor: 'pointer' }}>
                Zoom −
              </button>
            </div>
          </div>

          {/* Filter by type */}
          <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#37637a', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>Filter by Type</div>
            <button onClick={() => setFilterType(null)} style={{
              width: '100%', padding: '5px 10px', marginBottom: 4,
              background: !filterType ? '#1565c0' : 'transparent',
              border: `1px solid ${!filterType ? '#1565c0' : '#1a2d45'}`,
              borderRadius: 6, color: !filterType ? '#fff' : '#607d8b', fontSize: 11, cursor: 'pointer', textAlign: 'left',
            }}>All Resources</button>
            {Object.entries(NODE_TYPES).filter(([k]) => k !== 'pseudo:internet').map(([type, def]) => (
              <button key={type} onClick={() => setFilterType(filterType===type ? null : type)} style={{
                width: '100%', padding: '5px 10px', marginBottom: 4,
                background: filterType===type ? '#0f2236' : 'transparent',
                border: `1px solid ${filterType===type ? def.border : '#1a2d45'}`,
                borderRadius: 6, color: filterType===type ? def.border : '#607d8b',
                fontSize: 11, cursor: 'pointer', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: def.border }} />
                {def.label}
              </button>
            ))}
          </div>

          {/* Options */}
          <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#37637a', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>Options</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#607d8b', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showEdgeLabels}
                onChange={e => setShowEdgeLabels(e.target.checked)}
                style={{ accentColor: '#4fc3f7' }}
              />
              Show edge labels
            </label>
          </div>

          {/* Attack paths */}
          {paths.length > 0 && (
            <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 10, color: '#37637a', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>
                Highlight Attack Path
              </div>
              {highlightPath !== null && (
                <button onClick={clearHighlight} style={{
                  width: '100%', padding: '5px', marginBottom: 8,
                  background: 'transparent', border: '1px solid #37637a',
                  borderRadius: 6, color: '#607d8b', fontSize: 10, cursor: 'pointer',
                }}>
                  Clear Highlight
                </button>
              )}
              {paths.map((path, i) => (
                <button key={i} onClick={() => handlePathHighlight(i)} style={{
                  width: '100%', padding: '7px 10px', marginBottom: 4,
                  background: highlightPath===i ? '#1a0a0a' : 'transparent',
                  border: `1px solid ${highlightPath===i ? '#ef5350' : '#1a2d45'}`,
                  borderRadius: 6, cursor: 'pointer', textAlign: 'left',
                }}>
                  <div style={{ fontSize: 10, color: '#ef5350', marginBottom: 2 }}>
                    {path.exploitability} · Score {path.score?.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 10, color: '#607d8b' }}>
                    → {path.target_name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Centre: graph canvas ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative', flex: 1, background: '#070f1a', border: '1px solid #1a2d45', borderRadius: 8, overflow: 'hidden' }}>

            {/* Dot grid background */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              backgroundImage: 'radial-gradient(circle, #1a2d45 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              opacity: 0.4,
            }} />

            {loading && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#37637a', fontSize: 13 }}>
                Loading graph...
              </div>
            )}
            {!loading && !graphData && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#455a64' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⬡</div>
                <div style={{ fontSize: 13 }}>No graph data. Run a scan from the Dashboard.</div>
              </div>
            )}

            {/* Canvas */}
            <div ref={cyRef} style={{ width: '100%', height: '100%' }} />

            {/* Tooltip */}
            {tooltip && (
              <Tooltip
                x={tooltip.x} y={tooltip.y}
                data={tooltip.data}
                onClose={() => setTooltip(null)}
              />
            )}

            {/* Zoom controls overlay */}
            <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { label: '+', fn: zoomIn  },
                { label: '⊡', fn: fitGraph },
                { label: '−', fn: zoomOut },
              ].map(btn => (
                <button key={btn.label} onClick={btn.fn} style={{
                  width: 30, height: 30, background: '#0a1929', border: '1px solid #1a2d45',
                  borderRadius: 6, color: '#607d8b', fontSize: 14, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {btn.label}
                </button>
              ))}
            </div>

            {/* Path highlight banner */}
            {highlightPath !== null && paths[highlightPath] && (
              <div style={{
                position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)',
                background: '#1a0a0a', border: '1px solid #ef5350', borderRadius: 6,
                padding: '6px 14px', fontSize: 11, color: '#ef5350', whiteSpace: 'nowrap',
              }}>
                Highlighting: {paths[highlightPath].exploitability} path → {paths[highlightPath].target_name}
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: legend + selected details ── */}
        <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 12, flexShrink: 0, overflow: 'auto' }}>

          {/* Node legend */}
          <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#37637a', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>Node Types</div>
            {Object.entries(NODE_TYPES).map(([type, def]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: def.border, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 11, color: '#b0bec5' }}>{def.label}</div>
                  <div style={{ fontSize: 9, color: '#37637a', lineHeight: 1.4 }}>{def.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Edge legend */}
          <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#37637a', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>Edge Types</div>
            {Object.entries(EDGE_TYPES).map(([type, def]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 20, height: 2, background: def.color, flexShrink: 0, marginTop: 6 }} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{ fontSize: 11, color: '#b0bec5' }}>{def.label}</span>
                    <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: '#0f1a2a', color: RISK_COLORS[def.risk] }}>
                      {def.risk}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, color: '#37637a', lineHeight: 1.4 }}>{def.desc}</div>
                  <div style={{ fontSize: 9, color: '#1e3a5f', marginTop: 2 }}>
                    difficulty: {def.weight}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Node/edge border meaning */}
          <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 14 }}>
            <div style={{ fontSize: 10, color: '#37637a', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>Node Borders</div>
            {[
              { color: '#ff1744', label: 'Admin Role',       desc: 'Full account control' },
              { color: '#ef5350', label: 'Sensitive Asset',  desc: 'Crown jewel target'   },
              { color: '#f97316', label: 'Internet-Facing',  desc: 'Attacker entry point' },
              { color: '#37637a', label: 'Internal',         desc: 'No public exposure'   },
            ].map(b => (
              <div key={b.color} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', border: `3px solid ${b.color}`, background: 'transparent', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 11, color: '#b0bec5' }}>{b.label}</div>
                  <div style={{ fontSize: 9, color: '#37637a' }}>{b.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Selected element details */}
          {selected && (
            <div style={{ background: '#0a1929', border: `1px solid ${selected.kind==='node' ? (NODE_TYPES[selected.type]?.border || '#1a2d45') : (EDGE_TYPES[selected.edge_type]?.color || '#1a2d45')}`, borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 10, color: '#37637a', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 10 }}>
                Selected {selected.kind === 'node' ? 'Node' : 'Edge'}
              </div>
              {selected.kind === 'node' ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#e1f5fe', marginBottom: 4, wordBreak: 'break-all' }}>
                    {selected.name || selected.id}
                  </div>
                  <div style={{ fontSize: 10, color: NODE_TYPES[selected.type]?.border || '#607d8b', marginBottom: 8 }}>
                    {NODE_TYPES[selected.type]?.label || selected.type}
                  </div>
                  {[
                    { k: 'Region',          v: selected.region },
                    { k: 'Internet-Facing', v: selected.internet_facing ? 'Yes' : 'No' },
                    { k: 'Sensitive',       v: selected.is_sensitive ? 'Yes' : 'No' },
                    { k: 'Admin Access',    v: selected.is_admin ? 'Yes' : 'No' },
                  ].map(row => (
                    <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0', borderBottom: '1px solid #0d1e2f' }}>
                      <span style={{ color: '#455a64' }}>{row.k}</span>
                      <span style={{ color: row.v === 'Yes' ? '#ef5350' : '#607d8b' }}>{row.v}</span>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 500, color: EDGE_TYPES[selected.edge_type]?.color || '#e1f5fe', marginBottom: 6 }}>
                    {EDGE_TYPES[selected.edge_type]?.label || selected.edge_type}
                  </div>
                  <div style={{ fontSize: 11, color: '#607d8b', lineHeight: 1.5, marginBottom: 8 }}>
                    {EDGE_TYPES[selected.edge_type]?.desc || ''}
                  </div>
                  {[
                    { k: 'Difficulty', v: selected.weight?.toString() || '—' },
                    { k: 'Risk',       v: EDGE_TYPES[selected.edge_type]?.risk || 'INFO' },
                  ].map(row => (
                    <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, padding: '3px 0', borderBottom: '1px solid #0d1e2f' }}>
                      <span style={{ color: '#455a64' }}>{row.k}</span>
                      <span style={{ color: RISK_COLORS[row.v] || '#607d8b' }}>{row.v}</span>
                    </div>
                  ))}
                </>
              )}
              <button onClick={() => setSelected(null)} style={{
                marginTop: 10, width: '100%', padding: '4px', background: 'transparent',
                border: '1px solid #1a2d45', borderRadius: 5, color: '#455a64', fontSize: 10, cursor: 'pointer',
              }}>
                Deselect
              </button>
            </div>
          )}
        </div>
      </div>
    </PageLayout>
  )
}