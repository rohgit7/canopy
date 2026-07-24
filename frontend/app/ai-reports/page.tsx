'use client'

import { useEffect, useState, useMemo } from 'react'
import { PageLayout } from '@/components/PageLayout'
import { useScan } from '@/context/ScanContext'
import {
  Bot,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Terminal,
  Clock,
  Zap,
  ArrowRight,
  Search,
  BookOpen,
  Shield,
  Layers,
  RefreshCw,
  Lock,
  Code2
} from 'lucide-react'

function parseNarrative(s: any) {
  if (!s) return null
  if (typeof s === 'object') return s
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

export default function AIReportsPage() {
  const { results, loaded, refreshData } = useScan()
  const [paths, setPaths] = useState<any[]>([])
  const [score, setScore] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (results) {
      setPaths(results.attack_paths || [])
      setScore(results.score ?? null)
      setLoading(false)
    } else if (loaded) {
      setLoading(false)
    }
  }, [results, loaded])

  // Extract paths with AI narrative (100% dynamic from backend scan data)
  const narratedPaths = useMemo(() => {
    return paths.filter(p => p.ai_narrative)
  }, [paths])

  // Computed summary metrics directly from scan data
  const totalPathsCount = paths.length
  const totalNarratedCount = narratedPaths.length
  const criticalCount = paths.filter(p => p.exploitability === 'CRITICAL').length
  const highCount = paths.filter(p => p.exploitability === 'HIGH').length

  // Filter & search implementation
  const filteredNarratives = useMemo(() => {
    return narratedPaths.filter(path => {
      if (filter === 'CRITICAL' && path.exploitability !== 'CRITICAL') return false
      if (filter === 'HIGH' && path.exploitability !== 'HIGH') return false

      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const nar = parseNarrative(path.ai_narrative) || {}

      return (
        (path.target_name || path.target_id || '').toLowerCase().includes(q) ||
        (nar.headline || '').toLowerCase().includes(q) ||
        (nar.story || '').toLowerCase().includes(q) ||
        (nar.fix || '').toLowerCase().includes(q) ||
        (nar.business_impact || '').toLowerCase().includes(q)
      )
    })
  }, [narratedPaths, filter, searchQuery])

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <PageLayout
      title="AI Security Reports"
      subtitle="Plain-English security intelligence and remediation guides generated dynamically by Claude AI"
    >
      {/* Dynamic Executive Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-500/30 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950/50 p-6 shadow-2xl mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-400/30 text-blue-300 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5 text-blue-400 animate-pulse" />
              Claude AI Intelligence Engine
            </div>

            <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
              Executive AI Security Briefing
            </h2>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {score !== null
                ? `Your AWS environment security posture score is evaluated at ${score.toFixed(0)}/100. `
                : 'Run a security scan to evaluate your AWS environment. '
              }
              {paths.length === 0
                ? 'No attack paths detected in the current scan scope.'
                : `Canopy detected ${totalPathsCount} attack path${totalPathsCount > 1 ? 's' : ''}, with ${totalNarratedCount} synthesized AI threat narrative${totalNarratedCount > 1 ? 's' : ''} detailing step-by-step exploit vectors and recommended patches.`
              }
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={refreshData}
              className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg"
            >
              <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
              Refresh Scan Data
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Security Posture</span>
            <Shield className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-3xl font-black text-slate-100">
            {score !== null ? `${score.toFixed(0)}` : '—'} <span className="text-sm font-normal text-slate-400">/ 100</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">AWS Defense-in-Depth Score</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>AI Narratives</span>
            <Bot className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-3xl font-black text-purple-400">{totalNarratedCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Generated Threat Narratives</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Critical Vectors</span>
            <ShieldAlert className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-3xl font-black text-red-400">{criticalCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">High-Exploitability Paths</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-4 shadow-lg">
          <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Attack Paths</span>
            <Layers className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-emerald-400">{totalPathsCount}</div>
          <div className="text-[11px] text-slate-400 mt-1">Total Graph Chains Found</div>
        </div>
      </div>

      {/* Filter Toolbar & Search Bar */}
      {totalNarratedCount > 0 && (
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 w-full md:w-auto">
            {(['ALL', 'CRITICAL', 'HIGH'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${filter === tab ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'}`}
              >
                {tab === 'ALL' ? `All Narratives (${totalNarratedCount})` : tab === 'CRITICAL' ? `Critical (${criticalCount})` : `High (${highCount})`}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search AI narratives, fixes, or targets..."
              className="w-full rounded-xl border border-slate-800 bg-slate-900/90 pl-10 pr-4 py-2.5 text-xs text-slate-100 placeholder-slate-400 outline-none focus:border-blue-500 transition"
            />
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-20 text-slate-400 bg-slate-900/50 rounded-2xl border border-slate-800">
          <Bot className="mx-auto h-8 w-8 animate-spin text-blue-500 mb-2" />
          Analyzing attack graph & generating AI threat intelligence...
        </div>
      )}

      {/* Empty State when no Narratives exist */}
      {!loading && totalNarratedCount === 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-12 text-center space-y-3">
          <Bot className="mx-auto h-12 w-12 text-slate-600 mb-2" />
          <h3 className="text-base font-bold text-slate-200">No AI Threat Narratives Available</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {paths.length === 0
              ? 'No scan results found in database. Run a compliance scan from the Dashboard to analyze your AWS environment.'
              : 'AI narratives are automatically synthesized for critical and high severity attack paths. No critical paths were detected in your current scan.'
            }
          </p>
        </div>
      )}

      {/* Render Real AI Narratives */}
      {!loading && totalNarratedCount > 0 && (
        <div className="space-y-6">
          {filteredNarratives.map((path, idx) => {
            const nar = parseNarrative(path.ai_narrative)
            if (!nar) return null

            const isCritical = path.exploitability === 'CRITICAL'
            const targetName = path.target_name || path.target_id || 'AWS Target Resource'

            return (
              <div
                key={path.id || idx}
                className="rounded-2xl border border-slate-800 bg-slate-900/95 overflow-hidden shadow-2xl transition hover:border-slate-700"
              >
                {/* Header Banner */}
                <div className="border-b border-slate-800 bg-slate-950/80 p-5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${isCritical ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                          {path.exploitability || 'HIGH'} THREAT VECTOR
                        </span>
                        {path.score !== undefined && (
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono bg-slate-900 text-cyan-300 border border-slate-800">
                            Risk Score: {path.score.toFixed(0)}/100
                          </span>
                        )}
                        {path.blast_radius !== undefined && (
                          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono bg-slate-900 text-purple-300 border border-slate-800">
                            Blast Radius: {path.blast_radius.toFixed(0)}%
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 leading-snug">
                        <Bot className="h-5 w-5 text-purple-400 shrink-0" />
                        {nar.headline || `Attack path to ${targetName}`}
                      </h3>

                      <div className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                        Target Asset: <span className="text-cyan-300 font-bold">{targetName}</span>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Hop Attack Path Flow Visualization */}
                  {path.hops && path.hops.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                        <Layers size={12} className="text-purple-400" /> Hop Chain:
                      </span>
                      {path.hops.map((hop: any, hIdx: number) => (
                        <div key={hIdx} className="flex items-center gap-2 shrink-0">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 font-mono text-[11px] text-slate-300 flex items-center gap-1">
                            {hIdx === 0 && <Shield className="h-3 w-3 text-red-400" />}
                            {hop.source_name || hop.source_id || 'Origin'}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                          {hIdx === path.hops.length - 1 && (
                            <span className="px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-800/80 font-mono text-[11px] text-red-300 font-bold">
                              {hop.target_name || hop.target_id || targetName}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Structured Body Layout */}
                <div className="p-6 space-y-6">
                  
                  {/* Threat Scenario & Story */}
                  {nar.story && (
                    <div className="rounded-xl border border-blue-500/30 bg-blue-950/10 p-5 space-y-3">
                      <div className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-2 border-b border-blue-500/20 pb-2">
                        <BookOpen className="h-4 w-4 text-blue-400" />
                        AI Threat Explanation — Exploitation Scenario
                      </div>
                      <p className="text-slate-200 text-xs leading-relaxed font-sans whitespace-pre-wrap">
                        {nar.story}
                      </p>
                    </div>
                  )}

                  {/* Business Impact & Remediation Fix */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {nar.business_impact && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-4 space-y-2">
                        <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 text-amber-400" />
                          Business & Compliance Impact
                        </div>
                        <p className="text-amber-200/90 leading-relaxed">
                          {nar.business_impact}
                        </p>
                      </div>
                    )}

                    {nar.fix && (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-4 space-y-2">
                        <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            Recommended Fix
                          </span>
                          {nar.fix_time && (
                            <span className="text-[10px] text-emerald-400 font-mono">
                              ({nar.fix_time})
                            </span>
                          )}
                        </div>
                        <p className="text-emerald-200/90 leading-relaxed">
                          {nar.fix}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Attacker Profile Metadata Row */}
                  {(nar.attacker_difficulty || nar.time_to_exploit) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                      {nar.attacker_difficulty && (
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold">Attacker Complexity</span>
                          <div className="text-slate-100 font-bold mt-0.5">{nar.attacker_difficulty}</div>
                        </div>
                      )}
                      {nar.time_to_exploit && (
                        <div>
                          <span className="text-slate-400 text-[10px] uppercase font-bold">Time to Exploit</span>
                          <div className="text-red-400 font-bold mt-0.5">{nar.time_to_exploit}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CLI Remediation Script if provided by backend AI */}
                  {nar.remediation_cli && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <span className="flex items-center gap-1.5">
                          <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                          AWS CLI Remediation Script
                        </span>
                      </div>
                      <div className="relative rounded-xl border border-slate-800 bg-slate-950 p-4 font-mono text-[11px] text-emerald-300 overflow-x-auto">
                        <button
                          onClick={() => handleCopyCode(path.id || idx.toString(), nar.remediation_cli)}
                          className="absolute right-3 top-3 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-1 font-sans transition"
                        >
                          {copiedId === (path.id || idx.toString()) ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                          {copiedId === (path.id || idx.toString()) ? 'Copied' : 'Copy Script'}
                        </button>
                        <pre className="pt-2 leading-relaxed">{nar.remediation_cli}</pre>
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageLayout>
  )
}
