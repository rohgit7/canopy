'use client'
import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/PageLayout'
import { useScan } from '@/context/ScanContext'
import { requestJson } from '@/lib/api'

const TYPE_LABELS: Record<string,string> = {
  'ec2:instance':       'EC2 Instance',
  'ec2:security_group': 'Security Group',
  's3:bucket':          'S3 Bucket',
  'iam:role':           'IAM Role',
  'iam:user':           'IAM User',
  'lambda:function':    'Lambda Function',
  'pseudo:internet':    'Internet',
}
const TYPE_ICONS: Record<string,string> = {
  'ec2:instance':       'ti-server',
  'ec2:security_group': 'ti-shield',
  's3:bucket':          'ti-bucket',
  'iam:role':           'ti-key',
  'iam:user':           'ti-user',
  'lambda:function':    'ti-bolt',
  'pseudo:internet':    'ti-world',
}
const TYPE_COLORS: Record<string,string> = {
  'ec2:instance':       'var(--aws-orange)',
  'ec2:security_group': '#6b7280',
  's3:bucket':          'var(--aws-storage)',
  'iam:role':           'var(--aws-identity)',
  'iam:user':           '#b088ff',
  'lambda:function':    '#ec7211',
  'pseudo:internet':    'var(--aws-risk)',
}

export default function ResourcesPage() {
  const { results, loaded } = useScan()
  const [nodes,   setNodes]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('ALL')
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    if (results) {
      setNodes(results.graph_data?.nodes || [])
      setLoading(false)
    } else if (loaded) {
      setLoading(false)
    }
  }, [results, loaded])



  const types   = ['ALL', ...Array.from(new Set(nodes.map((n:any) => n.type))).filter(t => t !== 'pseudo:internet')]
  const visible = nodes
    .filter((n:any) => n.type !== 'pseudo:internet')
    .filter((n:any) => filter === 'ALL' || n.type === filter)
    .filter((n:any) => !search || (n.name||'').toLowerCase().includes(search.toLowerCase()))

  const byType = nodes.reduce((acc:any, n:any) => {
    if (n.type === 'pseudo:internet') return acc
    acc[n.type] = (acc[n.type]||0) + 1
    return acc
  }, {})

  return (
    <PageLayout title="Resources" subtitle="All AWS resources extracted from your account">

      {/* Summary tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 20 }}>
        {Object.entries(byType).map(([type, count]) => (
          <div key={type}
            onClick={() => setFilter(filter===type?'ALL':type)}
            style={{
              background: '#0a1929', border: `1px solid ${filter===type?(TYPE_COLORS[type]||'var(--aws-blue)'):'#1a2d45'}`,
              borderRadius: 8, padding: 12, cursor: 'pointer',
            }}>
            <i className={`ti ${TYPE_ICONS[type]||'ti-box'}`} style={{ fontSize: 20, color: TYPE_COLORS[type]||'#607d8b', display: 'block', marginBottom: 6 }} />
            <div style={{ fontSize: 20, fontWeight: 500, color: '#e1f5fe' }}>{count as number}</div>
            <div style={{ fontSize: 10, color: '#455a64', marginTop: 2 }}>{TYPE_LABELS[type]||type}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 6, padding: '6px 12px', flex: 1 }}>
          <i className="ti ti-search" style={{ fontSize: 14, color: '#455a64' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search resources by name..."
            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#b0bec5', fontSize: 12, flex: 1 }}
          />
        </div>
        <div style={{ fontSize: 11, color: '#455a64', alignSelf: 'center' }}>{visible.length} resources</div>
      </div>

      {/* Table */}
      {loading && <div style={{ color: '#37637a', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>Loading...</div>}
      {!loading && (
        <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Resource','Type','Region','Internet Facing','Sensitive'].map(h => (
                <th key={h} style={{ fontSize: 10, color: '#37637a', textTransform: 'uppercase', letterSpacing: '.7px', padding: '10px 14px', textAlign: 'left', borderBottom: '1px solid #1a2d45' }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {visible.map((n:any, i:number) => (
                <tr key={i} style={{ borderBottom: '1px solid #0d1e2f' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i className={`ti ${TYPE_ICONS[n.type]||'ti-box'}`} style={{ fontSize: 15, color: TYPE_COLORS[n.type]||'#607d8b' }} />
                      <span style={{ fontSize: 12, color: '#b0bec5' }}>{n.name || n.id}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#0f2236', color: TYPE_COLORS[n.type]||'#607d8b' }}>
                      {TYPE_LABELS[n.type]||n.type}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: '#455a64', padding: '10px 14px' }}>
                    {n.region || '—'}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {n.internet_facing
                      ? <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(209, 50, 18, .14)', color: 'var(--aws-risk)' }}>Yes</span>
                      : <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(122, 161, 22, .14)', color: 'var(--aws-storage)' }}>No</span>
                    }
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    {n.is_sensitive
                      ? <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(209, 50, 18, .14)', color: 'var(--aws-risk)' }}>Sensitive</span>
                      : <span style={{ fontSize: 10, color: '#37637a' }}>—</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#455a64', fontSize: 12 }}>
              No resources match the current filter
            </div>
          )}
        </div>
      )}
    </PageLayout>
  )
}
