'use client'
import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/PageLayout'

const API = process.env.NEXT_PUBLIC_API_URL

export default function IAMAnalyzerPage() {
  const [nodes,   setNodes]   = useState<any[]>([])
  const [edges,   setEdges]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/dashboard/me`)
      .then(r => r.json())
      .then(d => {
        setNodes(d.graph_data?.nodes || [])
        setEdges(d.graph_data?.links || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const roles  = nodes.filter((n:any) => n.type === 'iam:role')
  const users  = nodes.filter((n:any) => n.type === 'iam:user')
  const admins = roles.filter((n:any) => n.is_admin)

  const assumeEdges = edges.filter((e:any) => e.edge_type === 'CAN_ASSUME')
  const accessEdges = edges.filter((e:any) => e.edge_type === 'CAN_ACCESS')
  const roleEdges   = edges.filter((e:any) => e.edge_type === 'HAS_ROLE')

  const nodeById = nodes.reduce((acc:any, n:any) => ({ ...acc, [n.id]: n }), {})

  return (
    <PageLayout title="IAM Analyzer" subtitle="Identity relationships, trust chains, and privilege analysis">

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Roles',      value: roles.length,       color: '#8b5cf6', icon: 'ti-key'          },
          { label: 'Total Users',      value: users.length,       color: '#a78bfa', icon: 'ti-user'         },
          { label: 'Admin Roles',      value: admins.length,      color: '#ef5350', icon: 'ti-shield-x'     },
          { label: 'Trust Chains',     value: assumeEdges.length, color: '#ff9800', icon: 'ti-arrows-right' },
          { label: 'Resource Access',  value: accessEdges.length, color: '#4fc3f7', icon: 'ti-lock-open'    },
        ].map(card => (
          <div key={card.label} style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#455a64', textTransform: 'uppercase', letterSpacing: '.7px' }}>{card.label}</span>
              <i className={`ti ${card.icon}`} style={{ fontSize: 14, color: '#37637a' }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 500, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Admin roles */}
        <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#607d8b', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
            Admin Roles {admins.length > 0 && <span style={{ color: '#ef5350', marginLeft: 6 }}>⚠️ {admins.length} found</span>}
          </div>
          {loading && <div style={{ color: '#37637a', fontSize: 12 }}>Loading...</div>}
          {!loading && admins.length === 0 && <div style={{ color: '#4caf50', fontSize: 12 }}>No admin roles found</div>}
          {admins.map((r:any, i:number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #0d1e2f' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef5350', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: '#b0bec5' }}>{r.name}</div>
                <div style={{ fontSize: 10, color: '#455a64', marginTop: 2 }}>Administrator Access</div>
              </div>
              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#1a0a0a', color: '#ef5350' }}>ADMIN</span>
            </div>
          ))}
        </div>

        {/* Trust relationships */}
        <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#607d8b', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
            Trust Relationships (Role → Role)
          </div>
          {loading && <div style={{ color: '#37637a', fontSize: 12 }}>Loading...</div>}
          {!loading && assumeEdges.length === 0 && <div style={{ color: '#455a64', fontSize: 12 }}>No trust relationships found</div>}
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {assumeEdges.map((e:any, i:number) => {
              const src = nodeById[e.source]
              const tgt = nodeById[e.target]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #0d1e2f', fontSize: 11 }}>
                  <span style={{ color: '#8b5cf6', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {src?.name || e.source}
                  </span>
                  <i className="ti ti-arrow-right" style={{ fontSize: 12, color: '#ff9800', flexShrink: 0 }} />
                  <span style={{ color: tgt?.is_admin ? '#ef5350' : '#8b5cf6', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {tgt?.name || e.target}
                  </span>
                  <span style={{ fontSize: 9, color: '#37637a', marginLeft: 4 }}>{e.weight}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Instance roles */}
        <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#607d8b', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
            Instance Profile Assignments
          </div>
          {loading && <div style={{ color: '#37637a', fontSize: 12 }}>Loading...</div>}
          {!loading && roleEdges.length === 0 && <div style={{ color: '#455a64', fontSize: 12 }}>No instance profiles found</div>}
          {roleEdges.map((e:any, i:number) => {
            const src = nodeById[e.source]
            const tgt = nodeById[e.target]
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #0d1e2f', fontSize: 11 }}>
                <i className="ti ti-server" style={{ fontSize: 13, color: '#3b82f6' }} />
                <span style={{ color: '#b0bec5', flex: 1 }}>{src?.name || e.source}</span>
                <i className="ti ti-arrow-right" style={{ fontSize: 11, color: '#37637a' }} />
                <i className="ti ti-key" style={{ fontSize: 13, color: '#8b5cf6' }} />
                <span style={{ color: tgt?.is_admin ? '#ef5350' : '#8b5cf6' }}>{tgt?.name || e.target}</span>
              </div>
            )
          })}
        </div>

        {/* Resource access */}
        <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#607d8b', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 12 }}>
            IAM Resource Access (Policy Evaluation)
          </div>
          {loading && <div style={{ color: '#37637a', fontSize: 12 }}>Loading...</div>}
          {!loading && accessEdges.length === 0 && <div style={{ color: '#455a64', fontSize: 12 }}>No policy-based access edges found</div>}
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {accessEdges.map((e:any, i:number) => {
              const src = nodeById[e.source]
              const tgt = nodeById[e.target]
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #0d1e2f', fontSize: 11 }}>
                  <span style={{ color: '#8b5cf6', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src?.name || e.source}</span>
                  <i className="ti ti-lock-open" style={{ fontSize: 11, color: '#4fc3f7', flexShrink: 0 }} />
                  <span style={{ color: tgt?.is_sensitive ? '#ef5350' : '#f59e0b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>{tgt?.name || e.target}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </PageLayout>
  )
}