'use client'

import { useEffect, useState, useMemo } from 'react'
import { PageLayout } from '@/components/PageLayout'
import { useScan } from '@/context/ScanContext'
import {
  Key,
  User,
  ShieldAlert,
  ArrowRight,
  Lock,
  Unlock,
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Users,
  Shield,
  Eye
} from 'lucide-react'

function isRoleAdmin(n: any): boolean {
  if (!n) return false
  return Boolean(
    n.is_admin ||
    n.metadata?.is_admin ||
    n.is_sensitive ||
    (n.name && n.name.toLowerCase().includes('admin')) ||
    (n.arn && n.arn.toLowerCase().includes('admin'))
  )
}

export default function IAMAnalyzerPage() {
  const { results, loaded } = useScan()
  const [nodes, setNodes] = useState<any[]>([])
  const [edges, setEdges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIdentity, setSelectedIdentity] = useState<any | null>(null)
  const [filterType, setFilterType] = useState<'ALL' | 'ADMIN' | 'ROLE' | 'USER'>('ALL')

  useEffect(() => {
    if (results) {
      setNodes(results.graph_data?.nodes || [])
      setEdges(results.graph_data?.links || [])
      setLoading(false)
    } else if (loaded) {
      setLoading(false)
    }
  }, [results, loaded])

  // Categorize Nodes
  const roles = useMemo(() => nodes.filter((n: any) => n.type === 'iam:role'), [nodes])
  const users = useMemo(() => nodes.filter((n: any) => n.type === 'iam:user'), [nodes])
  const allIdentities = useMemo(() => [...roles, ...users], [roles, users])

  const adminRoles = useMemo(() => roles.filter(isRoleAdmin), [roles])
  const adminUsers = useMemo(() => users.filter(isRoleAdmin), [users])
  const totalAdmins = adminRoles.length + adminUsers.length

  // Categorize Edges
  const assumeEdges = useMemo(() => edges.filter((e: any) => e.edge_type === 'CAN_ASSUME'), [edges])
  const privEscEdges = useMemo(() => edges.filter((e: any) => e.edge_type === 'PRIVILEGE_ESCALATION'), [edges])
  const accessEdges = useMemo(() => edges.filter((e: any) => e.edge_type === 'CAN_ACCESS' || e.edge_type === 'HAS_POLICY'), [edges])
  const roleEdges = useMemo(() => edges.filter((e: any) => e.edge_type === 'HAS_ROLE'), [edges])

  // Map nodes by ID for fast lookup
  const nodeById = useMemo(() => {
    const map: Record<string, any> = {
      INTERNET: { id: 'INTERNET', name: 'Internet (Public)', type: 'pseudo:internet', is_admin: false }
    }
    nodes.forEach((n: any) => { map[n.id] = n })
    return map
  }, [nodes])

  // Filtered identities list
  const filteredIdentities = useMemo(() => {
    if (filterType === 'ADMIN') return allIdentities.filter(isRoleAdmin)
    if (filterType === 'ROLE') return roles
    if (filterType === 'USER') return users
    return allIdentities
  }, [allIdentities, roles, users, filterType])

  return (
    <PageLayout
      title="IAM Security & Privilege Analyzer"
      subtitle="Comprehensive AWS identity evaluation, trust relationships, escalation vectors, and policy risk analysis"
    >
      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
        <div
          onClick={() => setFilterType('ROLE')}
          className={`cursor-pointer rounded-xl border p-4 transition ${filterType === 'ROLE' ? 'border-purple-500 bg-purple-950/20' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'}`}
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">
            <span>IAM Roles</span>
            <Key className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-3xl font-black text-purple-400">{roles.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Service & Trust Roles</div>
        </div>

        <div
          onClick={() => setFilterType('USER')}
          className={`cursor-pointer rounded-xl border p-4 transition ${filterType === 'USER' ? 'border-cyan-500 bg-cyan-950/20' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'}`}
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">
            <span>IAM Users</span>
            <Users className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-black text-cyan-400">{users.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">User Account Principals</div>
        </div>

        <div
          onClick={() => setFilterType('ADMIN')}
          className={`cursor-pointer rounded-xl border p-4 transition ${filterType === 'ADMIN' ? 'border-red-500 bg-red-950/20' : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'}`}
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">
            <span>Admin Identities</span>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-3xl font-black text-red-500">{totalAdmins}</div>
          <div className="text-[11px] text-slate-400 mt-1">Full Admin Privileges</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">
            <span>Escalation Paths</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-amber-500">{privEscEdges.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">Role Escalation Vectors</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold uppercase tracking-wider mb-2">
            <span>Trust Chains</span>
            <Unlock className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-400">{assumeEdges.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">AssumeRole Relationships</div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 text-slate-400">
          <Key className="mx-auto h-8 w-8 animate-spin text-purple-400 mb-2" />
          Analyzing IAM identities & policy graph...
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT 7 COLS: IDENTITY LIST & PRIVILEGE ANALYSIS */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Filter Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                {(['ALL', 'ADMIN', 'ROLE', 'USER'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setFilterType(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filterType === tab ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'}`}
                  >
                    {tab === 'ALL' ? `All (${allIdentities.length})` : tab === 'ADMIN' ? `Admins (${totalAdmins})` : tab === 'ROLE' ? `Roles (${roles.length})` : `Users (${users.length})`}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-slate-400">Click identity to view policies & trust</span>
            </div>

            {/* Identities Card Grid */}
            <div className="space-y-3">
              {filteredIdentities.map((item, idx) => {
                const isAdmin = isRoleAdmin(item)
                const isSelected = selectedIdentity?.id === item.id
                const isUser = item.type === 'iam:user'
                const trustPrincipals = item.metadata?.trust_principals || []
                const isPublicTrust = trustPrincipals.includes('*')

                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedIdentity(item)}
                    className="cursor-pointer rounded-xl border p-4 transition-all duration-200"
                    style={{
                      borderColor: isSelected ? 'var(--aws-identity)' : isAdmin ? 'rgba(239, 68, 68, 0.4)' : '#1e293b',
                      background: isSelected ? 'rgba(140, 79, 255, 0.12)' : isAdmin ? 'rgba(209, 50, 18, 0.08)' : '#0a1929',
                      boxShadow: isSelected ? '0 0 16px rgba(140, 79, 255, 0.2)' : 'none'
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
                          style={{
                            background: isUser ? 'rgba(176, 136, 255, 0.15)' : 'rgba(140, 79, 255, 0.15)',
                            borderColor: isUser ? '#b088ff' : '#8c4fff',
                            color: isUser ? '#b088ff' : '#8c4fff'
                          }}
                        >
                          {isUser ? <User className="h-5 w-5" /> : <Key className="h-5 w-5" />}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-100">
                              {item.name || item.id}
                            </span>
                            {isAdmin && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                                ⚠️ ADMIN ACCESS
                              </span>
                            )}
                            {isPublicTrust && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                                🌐 PUBLIC TRUST (*)
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate max-w-md">
                            {item.arn || item.id}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] font-mono px-2 py-1 rounded bg-slate-900 text-slate-300 border border-slate-800">
                          {item.type}
                        </span>
                        {isSelected && (
                          <div className="text-[10px] text-purple-400 font-bold mt-1 flex items-center gap-1 justify-end">
                            <Eye size={10} /> INSPECTING
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Metadata Summary */}
                    <div className="mt-3 flex items-center gap-4 text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                      <span>Attached Policies: <strong className="text-slate-200">{item.metadata?.attached_policies?.length || (isAdmin ? 1 : 0)}</strong></span>
                      <span>Trust Principals: <strong className="text-slate-200">{trustPrincipals.length || 1}</strong></span>
                      {isUser && (
                        <span>MFA: <strong className={item.metadata?.has_mfa ? "text-emerald-400" : "text-red-400"}>{item.metadata?.has_mfa ? "ENABLED" : "DISABLED"}</strong></span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* PRIVILEGE ESCALATION VECTORS PANEL */}
            {privEscEdges.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-5 shadow-xl">
                <div className="flex items-center gap-2 border-b border-amber-500/20 pb-3 mb-3">
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Privilege Escalation Risk Vectors</h3>
                    <p className="text-[11px] text-amber-400/80">Identified non-admin roles possessing permission paths to assume Administrator rights</p>
                  </div>
                </div>

                <div className="space-y-2">
                  {privEscEdges.map((e: any, i: number) => {
                    const src = nodeById[e.source]
                    const tgt = nodeById[e.target]
                    return (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-amber-300 truncate">{src?.name || e.source}</div>
                          <div className="text-[10px] text-slate-400">Source Identity</div>
                        </div>

                        <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono">
                          <Zap size={12} />
                          PRIVILEGE ESCALATION
                          <ArrowRight size={12} />
                        </div>

                        <div className="flex-1 min-w-0 text-right">
                          <div className="font-bold text-red-400 truncate">{tgt?.name || e.target}</div>
                          <div className="text-[10px] text-slate-400">Target Admin Role</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT 5 COLS: TRUST RELATIONSHIPS & INSPECTOR PANEL */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* INSPECTOR PANEL (When an identity is selected) */}
            {selectedIdentity ? (
              <div className="rounded-xl border border-purple-500/40 bg-slate-900/95 p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-purple-400" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-100">Identity Policy Inspector</h3>
                      <p className="text-[11px] text-slate-400">{selectedIdentity.name || selectedIdentity.id}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedIdentity(null)}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Close
                  </button>
                </div>

                {/* Identity Summary */}
                <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 space-y-2 text-xs">
                  <div>
                    <span className="text-slate-400">ARN:</span>
                    <div className="font-mono text-cyan-400 text-[11px] break-all">{selectedIdentity.arn || selectedIdentity.id}</div>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-800 text-[11px]">
                    <span className="text-slate-400">Admin Status:</span>
                    <span className={isRoleAdmin(selectedIdentity) ? "text-red-400 font-bold" : "text-emerald-400"}>
                      {isRoleAdmin(selectedIdentity) ? "ADMINISTRATOR" : "STANDARD ROLE"}
                    </span>
                  </div>
                </div>

                {/* Attached Policies */}
                <div>
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Attached Policies</div>
                  <div className="space-y-1.5">
                    {selectedIdentity.metadata?.attached_policies && selectedIdentity.metadata.attached_policies.length > 0 ? (
                      selectedIdentity.metadata.attached_policies.map((p: any, idx: number) => (
                        <div key={idx} className="p-2 rounded bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                          <span className="font-mono text-purple-300">{typeof p === 'string' ? p : p.PolicyName || 'Policy'}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-400 border border-purple-800">ATTACHED</span>
                        </div>
                      ))
                    ) : isRoleAdmin(selectedIdentity) ? (
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                        <span className="font-mono text-red-400 font-bold">AdministratorAccess</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">FULL ADMIN</span>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">No explicit policy attachments listed</div>
                    )}
                  </div>
                </div>

                {/* Trust Principals */}
                <div>
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Trust Principals (Who can assume)</div>
                  <div className="space-y-1.5">
                    {(selectedIdentity.metadata?.trust_principals || ['*']).map((pr: string, idx: number) => (
                      <div key={idx} className="p-2 rounded bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                        <span className={`font-mono text-xs ${pr === '*' ? 'text-red-400 font-bold' : 'text-slate-300'}`}>
                          {pr === '*' ? '🌐 * (Public / Anyone)' : pr}
                        </span>
                        {pr === '*' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">CRITICAL RISK</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center text-xs text-slate-400">
                Select any IAM Role or User from the list to inspect attached policies, trust documents, and escalation risk.
              </div>
            )}

            {/* TRUST RELATIONSHIPS (CAN_ASSUME) */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
              <div className="text-xs font-bold text-slate-100 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Trust Relationships (Role Assumptions)</span>
                <Unlock className="h-4 w-4 text-emerald-400" />
              </div>

              {assumeEdges.length === 0 ? (
                <div className="text-xs text-slate-400 italic">No AssumeRole trust relationships detected</div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {assumeEdges.map((e: any, i: number) => {
                    const src = nodeById[e.source]
                    const tgt = nodeById[e.target]
                    const isPublic = e.source === 'INTERNET' || e.source === '*'

                    return (
                      <div key={i} className="flex items-center gap-2 p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                        <span className={`font-medium flex-1 truncate ${isPublic ? 'text-red-400 font-bold' : 'text-purple-300'}`}>
                          {src?.name || e.source}
                        </span>
                        <ArrowRight className="h-3 w-3 text-amber-500 shrink-0" />
                        <span className={`font-medium flex-1 text-right truncate ${isRoleAdmin(tgt) ? 'text-red-400 font-bold' : 'text-purple-300'}`}>
                          {tgt?.name || e.target}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* INSTANCE PROFILE ASSIGNMENTS (HAS_ROLE) */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
              <div className="text-xs font-bold text-slate-100 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>Instance Profile Assignments</span>
                <Server className="h-4 w-4 text-amber-400" />
              </div>

              {roleEdges.length === 0 ? (
                <div className="text-xs text-slate-400 italic">No instance profile role assignments detected</div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {roleEdges.map((e: any, i: number) => {
                    const src = nodeById[e.source]
                    const tgt = nodeById[e.target]
                    return (
                      <div key={i} className="flex items-center gap-2 p-2.5 rounded bg-slate-950 border border-slate-800 text-xs">
                        <Server className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span className="text-slate-300 flex-1 truncate">{src?.name || e.source}</span>
                        <ArrowRight className="h-3 w-3 text-slate-500 shrink-0" />
                        <Key className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                        <span className={`flex-1 text-right truncate font-medium ${isRoleAdmin(tgt) ? 'text-red-400 font-bold' : 'text-purple-300'}`}>
                          {tgt?.name || e.target}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
