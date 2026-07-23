'use client'

import { useEffect, useState, useMemo } from 'react'
import { PageLayout } from '@/components/PageLayout'
import { useScan } from '@/context/ScanContext'
import {
  Search,
  Server,
  Shield,
  Database,
  Key,
  User,
  Zap,
  Globe,
  Globe2,
  ShieldAlert,
  SlidersHorizontal,
  ChevronRight,
  Eye,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Layers,
  ArrowUpDown,
  Filter
} from 'lucide-react'

const TYPE_LABELS: Record<string, string> = {
  'ec2:instance':       'EC2 Instance',
  'ec2:security_group': 'Security Group',
  's3:bucket':          'S3 Bucket',
  'iam:role':           'IAM Role',
  'iam:user':           'IAM User',
  'lambda:function':    'Lambda Function',
  'pseudo:internet':    'Internet',
}

const TYPE_COLORS: Record<string, string> = {
  'ec2:instance':       '#ff9900',
  'ec2:security_group': '#146eb4',
  's3:bucket':          '#7aa116',
  'iam:role':           '#8c4fff',
  'iam:user':           '#b088ff',
  'lambda:function':    '#ec7211',
  'pseudo:internet':    '#ef4444',
}

export default function ResourcesPage() {
  const { results, loaded } = useScan()
  const [nodes, setNodes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState('ALL')
  const [search, setSearch] = useState('')
  const [internetFacingOnly, setInternetFacingOnly] = useState(false)
  const [sensitiveOnly, setSensitiveOnly] = useState(false)
  const [selectedResource, setSelectedResource] = useState<any | null>(null)
  const [sortField, setSortField] = useState<'name' | 'type' | 'region'>('name')
  const [sortAsc, setSortAsc] = useState(true)

  useEffect(() => {
    if (results) {
      setNodes(results.graph_data?.nodes || [])
      setLoading(false)
    } else if (loaded) {
      setLoading(false)
    }
  }, [results, loaded])

  // Filter out internet virtual node
  const validNodes = useMemo(() => {
    return nodes.filter((n: any) => n.id !== 'INTERNET' && n.type !== 'pseudo:internet')
  }, [nodes])

  // Categorize
  const byType = useMemo(() => {
    return validNodes.reduce((acc: Record<string, number>, n: any) => {
      acc[n.type] = (acc[n.type] || 0) + 1
      return acc
    }, {})
  }, [validNodes])

  // Summary Metrics
  const totalCount = validNodes.length
  const internetFacingCount = validNodes.filter(n => n.internet_facing).length
  const sensitiveCount = validNodes.filter(n => n.is_sensitive || n.is_admin || n.metadata?.is_admin).length
  const regionsCount = new Set(validNodes.map(n => n.region).filter(Boolean)).size

  // Filtered & Sorted Resources
  const filteredResources = useMemo(() => {
    return validNodes
      .filter((n: any) => filterType === 'ALL' || n.type === filterType)
      .filter((n: any) => !internetFacingOnly || n.internet_facing)
      .filter((n: any) => !sensitiveOnly || n.is_sensitive || n.is_admin || n.metadata?.is_admin)
      .filter((n: any) => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
          (n.name || '').toLowerCase().includes(q) ||
          (n.id || '').toLowerCase().includes(q) ||
          (n.arn || '').toLowerCase().includes(q) ||
          (n.type || '').toLowerCase().includes(q)
        )
      })
      .sort((a: any, b: any) => {
        let valA = (a[sortField] || '').toString().toLowerCase()
        let valB = (b[sortField] || '').toString().toLowerCase()
        if (valA < valB) return sortAsc ? -1 : 1
        if (valA > valB) return sortAsc ? 1 : -1
        return 0
      })
  }, [validNodes, filterType, internetFacingOnly, sensitiveOnly, search, sortField, sortAsc])

  // Connected edges to selected resource
  const connectedEdges = useMemo(() => {
    if (!selectedResource || !results?.graph_data?.links) return []
    return results.graph_data.links.filter(
      (l: any) => l.source === selectedResource.id || l.target === selectedResource.id
    )
  }, [selectedResource, results])

  const renderTypeIcon = (type: string) => {
    switch (type) {
      case 'ec2:instance':       return <Server className="h-4 w-4 text-amber-500" />
      case 'ec2:security_group': return <Shield className="h-4 w-4 text-blue-500" />
      case 's3:bucket':          return <Database className="h-4 w-4 text-lime-500" />
      case 'iam:role':           return <Key className="h-4 w-4 text-purple-400" />
      case 'iam:user':           return <User className="h-4 w-4 text-purple-300" />
      case 'lambda:function':    return <Zap className="h-4 w-4 text-orange-400" />
      default:                   return <Layers className="h-4 w-4 text-slate-400" />
    }
  }

  return (
    <PageLayout
      title="AWS Infrastructure Inventory"
      subtitle="Complete asset catalog, security exposure state, and relational dependency mapping"
    >
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Total Assets</span>
            <Layers className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-3xl font-black text-slate-100">{totalCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Discovered AWS resources</div>
        </div>

        <div
          onClick={() => setInternetFacingOnly(!internetFacingOnly)}
          className={`cursor-pointer rounded-xl border p-4 shadow-lg transition ${internetFacingOnly ? 'border-red-500 bg-red-950/20' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'}`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Internet Facing</span>
            <Globe className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-3xl font-black text-red-500">{internetFacingCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Publicly exposed perimeter nodes</div>
        </div>

        <div
          onClick={() => setSensitiveOnly(!sensitiveOnly)}
          className={`cursor-pointer rounded-xl border p-4 shadow-lg transition ${sensitiveOnly ? 'border-amber-500 bg-amber-950/20' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'}`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Sensitive / Admin</span>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-amber-500">{sensitiveCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Crown jewels & privileged roles</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Regions Coverage</span>
            <Globe2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-400">{regionsCount || 1}</div>
          <div className="text-[11px] text-slate-400 mt-1">AWS multi-region distribution</div>
        </div>
      </div>

      {/* Resource Category Type Chips */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {Object.entries(byType).map(([type, count]) => {
          const isSelected = filterType === type
          const color = TYPE_COLORS[type] || '#ff9900'

          return (
            <div
              key={type}
              onClick={() => setFilterType(isSelected ? 'ALL' : type)}
              className="cursor-pointer rounded-xl border p-3.5 transition-all duration-200"
              style={{
                borderColor: isSelected ? color : '#1e293b',
                background: isSelected ? 'rgba(15, 23, 42, 0.95)' : '#0a1929',
                boxShadow: isSelected ? `0 0 16px ${color}33` : 'none'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                {renderTypeIcon(type)}
                <span className="text-xs font-mono font-bold text-slate-300">{count as number}</span>
              </div>
              <div className="text-xs font-bold text-slate-100 truncate">
                {TYPE_LABELS[type] || type}
              </div>
            </div>
          )
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3 mb-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets by Name, ARN, Resource ID, or Service Type..."
            className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-400 outline-none focus:border-purple-500 transition"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={() => setInternetFacingOnly(!internetFacingOnly)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${internetFacingOnly ? 'border-red-500 bg-red-950/40 text-red-300' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'}`}
          >
            <Globe size={13} /> Internet Facing ({internetFacingCount})
          </button>

          <button
            onClick={() => setSensitiveOnly(!sensitiveOnly)}
            className={`px-3 py-2 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${sensitiveOnly ? 'border-amber-500 bg-amber-950/40 text-amber-300' : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'}`}
          >
            <ShieldAlert size={13} /> Sensitive ({sensitiveCount})
          </button>

          {filterType !== 'ALL' && (
            <button
              onClick={() => setFilterType('ALL')}
              className="px-3 py-2 rounded-xl border border-slate-800 bg-slate-900 text-xs font-bold text-cyan-400 hover:bg-slate-800"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="text-center py-20 text-slate-400">
          <Layers className="mx-auto h-8 w-8 animate-spin text-blue-500 mb-2" />
          Loading asset catalog...
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* MAIN RESOURCE INVENTORY TABLE */}
          <div className="lg:col-span-8">
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/50">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <Filter size={14} className="text-purple-400" />
                  Showing {filteredResources.length} of {totalCount} Resources
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="cursor-pointer hover:text-slate-200 flex items-center gap-1" onClick={() => { setSortField('name'); setSortAsc(!sortAsc) }}>
                    Name <ArrowUpDown size={11} />
                  </span>
                  <span className="cursor-pointer hover:text-slate-200 flex items-center gap-1" onClick={() => { setSortField('type'); setSortAsc(!sortAsc) }}>
                    Type <ArrowUpDown size={11} />
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/30 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      <th className="p-3.5">Resource Name & ID</th>
                      <th className="p-3.5">Type</th>
                      <th className="p-3.5">Region</th>
                      <th className="p-3.5">Exposure</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-xs">
                    {filteredResources.map((n: any, idx: number) => {
                      const color = TYPE_COLORS[n.type] || '#94a3b8'
                      const isSelected = selectedResource?.id === n.id
                      const isSensitive = n.is_sensitive || n.is_admin || n.metadata?.is_admin

                      return (
                        <tr
                          key={idx}
                          onClick={() => setSelectedResource(n)}
                          className="cursor-pointer transition hover:bg-slate-800/40"
                          style={{
                            background: isSelected ? 'rgba(37, 99, 235, 0.12)' : 'transparent'
                          }}
                        >
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              {renderTypeIcon(n.type)}
                              <div>
                                <div className="font-bold text-slate-100 flex items-center gap-2">
                                  {n.name || n.id}
                                  {isSensitive && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-800">
                                      CROWN JEWEL
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-slate-400 truncate max-w-xs">
                                  {n.arn || n.id}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="p-3.5">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-semibold"
                              style={{ background: `${color}20`, color }}
                            >
                              {TYPE_LABELS[n.type] || n.type}
                            </span>
                          </td>

                          <td className="p-3.5 text-slate-400 font-mono text-[11px]">
                            {n.region || 'global'}
                          </td>

                          <td className="p-3.5">
                            {n.internet_facing ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800 flex items-center gap-1 w-max">
                                <Globe size={10} /> PUBLIC EXPOSED
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-950 text-slate-400 border border-slate-800">
                                INTERNAL SECURE
                              </span>
                            )}
                          </td>

                          <td className="p-3.5 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedResource(n)
                              }}
                              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {filteredResources.length === 0 && (
                <div className="p-12 text-center text-slate-400 text-xs">
                  No resources match your search or filter parameters.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT 4 COLS: RESOURCE DETAILS INSPECTOR DRAWER */}
          <div className="lg:col-span-4 space-y-4">
            {selectedResource ? (
              <div className="rounded-xl border border-blue-500/40 bg-slate-900/95 p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    {renderTypeIcon(selectedResource.type)}
                    <div>
                      <h3 className="text-sm font-bold text-slate-100 truncate max-w-[200px]">
                        {selectedResource.name || selectedResource.id}
                      </h3>
                      <p className="text-[11px] font-mono text-cyan-400">{selectedResource.type}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedResource(null)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Close
                  </button>
                </div>

                {/* Resource Info Attributes */}
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase font-bold">Resource ARN</span>
                      <div className="font-mono text-cyan-300 text-[10px] break-all">{selectedResource.arn || selectedResource.id}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div>
                        <span className="text-slate-400">AWS Region:</span>
                        <div className="font-mono text-slate-200">{selectedResource.region || 'global'}</div>
                      </div>
                      <div>
                        <span className="text-slate-400">Account ID:</span>
                        <div className="font-mono text-slate-200">{selectedResource.account_id || '123456789012'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Exposure & Sensitivity Status */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">Perimeter Ingress</div>
                      <div className={`font-bold mt-0.5 ${selectedResource.internet_facing ? 'text-red-400' : 'text-emerald-400'}`}>
                        {selectedResource.internet_facing ? 'PUBLIC EXPOSED' : 'PRIVATE / ISOLATED'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <div className="text-slate-400 text-[10px] uppercase font-bold">Data Sensitivity</div>
                      <div className={`font-bold mt-0.5 ${selectedResource.is_sensitive ? 'text-amber-400' : 'text-slate-300'}`}>
                        {selectedResource.is_sensitive ? 'HIGH CRITICALITY' : 'STANDARD ASSET'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Connected Dependency Links */}
                <div>
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Graph Relationships ({connectedEdges.length})</span>
                    <span className="text-[10px] text-cyan-400">Dependency Connections</span>
                  </div>

                  {connectedEdges.length === 0 ? (
                    <div className="text-xs text-slate-400 italic">No direct graph links detected for this asset</div>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {connectedEdges.map((e: any, idx: number) => {
                        const isSource = e.source === selectedResource.id
                        const partnerId = isSource ? e.target : e.source

                        return (
                          <div key={idx} className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] flex items-center justify-between">
                            <span className="text-slate-400">{isSource ? 'Outbound ➔' : '➔ Inbound'}</span>
                            <span className="font-mono text-cyan-300 truncate max-w-[150px]">{partnerId}</span>
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-amber-400 border border-slate-800">
                              {e.edge_type}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 text-center text-xs text-slate-400">
                <Eye className="mx-auto h-8 w-8 text-slate-600 mb-2" />
                Select any resource row in the table to inspect its ARN details, exposure status, and connected dependency graph links.
              </div>
            )}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
