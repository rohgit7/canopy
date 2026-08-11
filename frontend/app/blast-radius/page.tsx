'use client'

import { useEffect, useState, useMemo } from 'react'
import { PageLayout } from '@/components/PageLayout'
import { useScan } from '@/context/ScanContext'
import {
  Flame,
  Layers,
  Calculator,
  Clock,
  ShieldAlert,
  Key,
  Database,
  Server,
  User,
  Zap,
  ArrowRight,
  Search,
  Activity,
  Shield,
  Globe,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  FileText
} from 'lucide-react'

const DAMAGE_WEIGHTS: Record<string, number> = {
  'iam:role':          10.0,
  'rds:instance':       8.0,
  'rds:cluster':        7.5,
  'iam:user':           7.0,
  's3:bucket':          6.0,
  'lambda:function':    5.0,
  'ec2:instance':       4.0,
  'ec2:security_group': 2.0,
  'apigateway:rest':    3.5,
  'apigateway:http':    3.0,
  'apigateway:websocket': 3.0,
}

const TYPE_LABELS: Record<string, string> = {
  'iam:role':          'IAM Roles',
  'iam:user':          'IAM Users',
  's3:bucket':         'S3 Buckets',
  'lambda:function':   'Lambda Functions',
  'ec2:instance':      'EC2 Instances',
  'ec2:security_group': 'Security Groups',
  'rds:instance':      'RDS Databases',
  'rds:cluster':       'RDS Clusters',
  'apigateway:rest':   'API Gateway REST',
  'apigateway:http':   'API Gateway HTTP',
  'apigateway:websocket': 'API Gateway WebSocket',
}

function renderTypeIcon(type: string) {
  switch (type) {
    case 'iam:role':          return <Key className="h-4 w-4 text-purple-400 shrink-0" />
    case 'iam:user':          return <User className="h-4 w-4 text-purple-300 shrink-0" />
    case 's3:bucket':         return <Database className="h-4 w-4 text-lime-400 shrink-0" />
    case 'lambda:function':   return <Zap className="h-4 w-4 text-orange-400 shrink-0" />
    case 'ec2:instance':      return <Server className="h-4 w-4 text-blue-400 shrink-0" />
    case 'ec2:security_group': return <Shield className="h-4 w-4 text-slate-400 shrink-0" />
    case 'apigateway:rest':
    case 'apigateway:http':
    case 'apigateway:websocket': return <Globe className="h-4 w-4 text-teal-400 shrink-0" />
    case 'rds:instance':
    case 'rds:cluster': return <Database className="h-4 w-4 text-violet-400 shrink-0" />
    default:                  return <Layers className="h-4 w-4 text-cyan-400 shrink-0" />
  }
}

export default function BlastRadiusPage() {
  const { results, loaded } = useScan()
  const [paths, setPaths] = useState<any[]>(() => results?.attack_paths || [])
  const [nodes, setNodes] = useState<any[]>(() => results?.graph_data?.nodes || [])
  const [links, setLinks] = useState<any[]>(() => results?.graph_data?.links || [])
  const loading = !loaded
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'ALL' | 'CRITICAL' | 'ADMIN'>('ALL')
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)

  useEffect(() => {
    if (results) {
      setPaths(results.attack_paths || [])
      setNodes(results.graph_data?.nodes || [])
      setLinks(results.graph_data?.links || [])
    }
  }, [results])

  // helper to get valid target ID
  const getTargetId = (p: any): string => {
    if (p.target_id && p.target_id !== 'undefined') return String(p.target_id)
    if (p.hops && p.hops.length > 0) {
      const lastHop = p.hops[p.hops.length - 1]
      if (lastHop?.target_id && lastHop.target_id !== 'undefined') return String(lastHop.target_id)
    }
    return String(p.target_name || '')
  }

  // Compute blast radius metrics for a target node using graph traversal
  const blastDataByTarget = useMemo(() => {
    const nodeMap = new Map<string, any>()
    nodes.forEach(n => {
      nodeMap.set(String(n.id), n)
      if (n.name) nodeMap.set(String(n.name), n)
      if (n.arn) nodeMap.set(String(n.arn), n)
    })

    const adjList = new Map<string, string[]>()
    links.forEach(link => {
      const s = String(link.source)
      const t = String(link.target)
      if (!adjList.has(s)) adjList.set(s, [])
      adjList.get(s)!.push(t)
    })

    const validNodesCount = Math.max(1, nodes.filter(n => n.id !== 'INTERNET' && n.type !== 'pseudo:internet').length)
    const maxPossibleDamage = Math.round(validNodesCount * 10.0)

    const map = new Map<string, any>()

    // Evaluate targets from attack paths and nodes
    const targetIds = new Set<string>()
    paths.forEach(p => {
      const tid = getTargetId(p)
      if (tid) targetIds.add(tid)
      if (p.target_name) targetIds.add(p.target_name)
    })
    nodes.forEach(n => {
      if (n.is_admin || n.is_sensitive || n.type === 'iam:role') {
        targetIds.add(String(n.id))
      }
    })

    targetIds.forEach(targetKey => {
      const targetNode = nodeMap.get(targetKey)
      const realTargetId = targetNode?.id || targetKey
      const visited = new Set<string>()
      const queue = [realTargetId]
      visited.add(realTargetId)

      // Collect nodes from path hops if targetKey matches an attack path
      paths.forEach(p => {
        const pTid = getTargetId(p)
        if ((pTid === targetKey || p.target_name === targetKey) && p.hops) {
          p.hops.forEach((h: any) => {
            if (h.source_id && h.source_id !== 'INTERNET' && h.source_id !== 'undefined') visited.add(String(h.source_id))
            if (h.target_id && h.target_id !== 'INTERNET' && h.target_id !== 'undefined') visited.add(String(h.target_id))
          })
        }
      })

      while (queue.length > 0) {
        const curr = queue.shift()!
        const neighbors = adjList.get(curr) || []
        for (const nbr of neighbors) {
          if (!visited.has(nbr)) {
            visited.add(nbr)
            queue.push(nbr)
          }
        }
      }

      visited.delete(realTargetId)
      visited.delete('INTERNET')
      visited.delete('undefined')

      let totalDamage = 0
      let sensitiveCount = 0
      let isAdmin = false
      const reachableByType: Record<string, number> = {}

      visited.forEach(rid => {
        const n = nodeMap.get(rid) || {}
        const rtype = n.type || 'unknown'
        if (rtype === 'pseudo:internet') return

        const weight = DAMAGE_WEIGHTS[rtype] || 1.0
        totalDamage += weight
        reachableByType[rtype] = (reachableByType[rtype] || 0) + 1

        if (n.is_sensitive) sensitiveCount++
        if (n.is_admin || n.metadata?.is_admin) isAdmin = true
      })

      if (targetNode?.is_admin || targetNode?.metadata?.is_admin) {
        isAdmin = true
      }

      if (visited.size === 0) {
        const tType = targetNode?.type || 'iam:role'
        reachableByType[tType] = 1
        totalDamage = DAMAGE_WEIGHTS[tType] || 10.0
      }

      const totalDamageWeight = Math.round(totalDamage)
      const scorePct = maxPossibleDamage > 0 ? Math.min(100, Math.round((totalDamageWeight / maxPossibleDamage) * 100)) : 0

      let recoveryHrs = 0
      if (isAdmin) {
        recoveryHrs = 168.0
      } else {
        recoveryHrs = (
          (reachableByType['rds:instance'] || 0) * 8 +
          (reachableByType['s3:bucket'] || 0) * 4 +
          (reachableByType['ec2:instance'] || 0) * 2 +
          (reachableByType['lambda:function'] || 0) * 1
        )
        if (recoveryHrs === 0) recoveryHrs = 12.0
      }

      const dataObj = {
        targetId: realTargetId,
        targetName: targetNode?.name || targetKey,
        targetType: targetNode?.type || 'unknown',
        targetArn: (targetNode?.arn && targetNode.arn !== 'undefined') ? targetNode.arn : (realTargetId !== 'undefined' ? realTargetId : targetKey),
        reachableCount: Math.max(1, visited.size),
        reachableByType,
        totalDamageWeight,
        maxPossibleDamage,
        scorePct,
        sensitiveCount,
        isAdmin,
        recoveryHrs,
      }

      map.set(realTargetId, dataObj)
      map.set(targetKey, dataObj)
      if (targetNode?.name) map.set(String(targetNode.name), dataObj)
    })

    return map
  }, [nodes, links, paths])

  // Combine attack paths with blast radius graph analysis
  const evaluatedTargets = useMemo(() => {
    if (paths.length === 0 && blastDataByTarget.size === 0) return []

    const list: any[] = []
    const processedTargets = new Set<string>()

    paths.forEach(p => {
      const tid = getTargetId(p)
      const name = p.target_name || tid
      if (processedTargets.has(tid) || processedTargets.has(name)) return

      processedTargets.add(tid)
      if (name) processedTargets.add(name)

      const computed = blastDataByTarget.get(tid) || blastDataByTarget.get(name)
      const displayArn = computed?.targetArn || (p.target_arn && p.target_arn !== 'undefined' ? p.target_arn : (tid !== 'undefined' ? tid : name))
      const targetScore = computed?.scorePct !== undefined && computed.scorePct > 0
        ? computed.scorePct
        : (p.blast_radius ? Math.round(p.blast_radius) : 0)

      list.push({
        ...p,
        targetId: tid !== 'undefined' ? tid : (computed?.targetId || name),
        targetArn: displayArn,
        targetName: name || computed?.targetName || tid,
        computed,
        finalScore: targetScore,
      })
    })

    blastDataByTarget.forEach((computed, key) => {
      if (!processedTargets.has(key) && !processedTargets.has(computed.targetId) && !processedTargets.has(computed.targetName) && (computed.isAdmin || computed.reachableCount > 0)) {
        processedTargets.add(key)
        processedTargets.add(computed.targetId)
        processedTargets.add(computed.targetName)

        list.push({
          targetId: computed.targetId,
          targetArn: computed.targetArn,
          targetName: computed.targetName,
          exploitability: computed.isAdmin ? 'CRITICAL' : 'HIGH',
          hop_count: 1,
          hops: [],
          computed,
          finalScore: computed.scorePct,
        })
      }
    })

    return list.sort((a, b) => b.finalScore - a.finalScore)
  }, [paths, blastDataByTarget])

  const filteredTargets = useMemo(() => {
    return evaluatedTargets
      .filter(item => filter === 'ALL' || (filter === 'CRITICAL' ? item.exploitability === 'CRITICAL' : item.computed?.isAdmin))
      .filter(item => {
        if (!search.trim()) return true
        const q = search.toLowerCase()
        return (
          item.targetName.toLowerCase().includes(q) ||
          item.targetId.toLowerCase().includes(q)
        )
      })
  }, [evaluatedTargets, filter, search])

  // Auto-select first item when targets load
  useEffect(() => {
    if (filteredTargets.length > 0 && !selectedTargetId) {
      setSelectedTargetId(filteredTargets[0].targetId)
    }
  }, [filteredTargets, selectedTargetId])

  const selectedItem = useMemo(() => {
    return filteredTargets.find(t => t.targetId === selectedTargetId) || filteredTargets[0] || null
  }, [filteredTargets, selectedTargetId])

  const maxBlast = evaluatedTargets.length ? Math.max(...evaluatedTargets.map(t => t.finalScore)) : 0
  const avgBlast = evaluatedTargets.length ? Math.round(evaluatedTargets.reduce((s, t) => s + t.finalScore, 0) / evaluatedTargets.length) : 0
  const totalCrownJewels = evaluatedTargets.reduce((s, t) => s + (t.computed?.sensitiveCount || 0), 0)
  const maxRecovery = evaluatedTargets.length ? Math.max(...evaluatedTargets.map(t => t.computed?.recoveryHrs || 0)) : 0

  const getScoreColor = (score: number) =>
    score >= 70 ? '#ef4444' : score >= 40 ? '#f97316' : '#10b981'

  const comp = selectedItem?.computed || {}
  const selectedScorePct = selectedItem?.finalScore ?? comp.scorePct ?? 0
  const maxPossibleDamage = comp.maxPossibleDamage ?? 140
  const totalDamageWeight = comp.totalDamageWeight ?? Math.round((selectedScorePct / 100) * maxPossibleDamage)
  const selectedScoreColor = getScoreColor(selectedScorePct)
  const reachableByType = comp.reachableByType || {}
  const reachableCount = comp.reachableCount ?? 1
  const recoveryHrs = comp.recoveryHrs ?? (comp.isAdmin ? 168 : 12)
  const sensitiveCount = comp.sensitiveCount ?? 0
  const isAdmin = comp.isAdmin || selectedItem?.exploitability === 'CRITICAL'

  return (
    <PageLayout
      title="Blast Radius & Damage Simulator"
      subtitle="Interactive impact calculator, reachable asset graph matrix, and post-exploitation recovery estimations"
    >
      {/* Top Executive Summary KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Peak Blast Radius</span>
            <Flame className="h-4 w-4 text-red-500" />
          </div>
          <div className="text-3xl font-black text-red-500">{maxBlast}%</div>
          <div className="text-[11px] text-slate-400 mt-1">Maximum single-target damage</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Average Blast Radius</span>
            <Activity className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-3xl font-black text-amber-500">{avgBlast}%</div>
          <div className="text-[11px] text-slate-400 mt-1">Mean post-exploitation scope</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>Exposed Crown Jewels</span>
            <ShieldAlert className="h-4 w-4 text-red-400" />
          </div>
          <div className="text-3xl font-black text-slate-100">{totalCrownJewels}</div>
          <div className="text-[11px] text-slate-400 mt-1">Reachable sensitive assets</div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-20 text-slate-400">
          <Flame className="mx-auto h-8 w-8 animate-spin text-red-500 mb-2" />
          Calculating blast radius damage graph...
        </div>
      )}

      {/* Main Split View Master-Detail UI */}
      {!loading && evaluatedTargets.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT SIDEBAR PANEL: Target Selector List (4 Cols) */}
          <div className="lg:col-span-4 space-y-3">
            
            {/* Search & Filter Toolbar */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search targets..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/90 pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-400 outline-none focus:border-purple-500 transition"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {(['ALL', 'CRITICAL', 'ADMIN'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setFilter(tab)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition shrink-0 ${filter === tab ? 'bg-amber-600 text-white border border-amber-500' : 'border border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'}`}
                  >
                    {tab === 'ALL' ? `All (${evaluatedTargets.length})` : tab === 'CRITICAL' ? 'Critical' : 'Takeover'}
                  </button>
                ))}
              </div>
            </div>

            {/* Target Items List */}
            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {filteredTargets.map((t) => {
                const isSelected = selectedItem?.targetId === t.targetId
                const scoreColor = getScoreColor(t.finalScore)

                return (
                  <div
                    key={t.targetId}
                    onClick={() => setSelectedTargetId(t.targetId)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${isSelected ? 'bg-slate-900 border-amber-500 shadow-lg ring-1 ring-amber-500/40' : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'}`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${t.exploitability === 'CRITICAL' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                        {t.exploitability || 'HIGH'}
                      </span>
                      <span className="text-sm font-black" style={{ color: scoreColor }}>
                        {t.finalScore}%
                      </span>
                    </div>

                    <div className="font-bold text-xs text-slate-200 truncate flex items-center justify-between">
                      <span className="truncate">{t.targetName}</span>
                      <ChevronRight size={14} className={`shrink-0 transition ${isSelected ? 'text-amber-400 translate-x-0.5' : 'text-slate-600'}`} />
                    </div>

                    <div className="text-[10px] text-slate-400 truncate font-mono mt-0.5">
                      {t.targetId}
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 h-1.5 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800/60">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(t.finalScore, 100)}%`, backgroundColor: scoreColor }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* RIGHT MAIN PANEL: Dynamic Blast Radius Inspector (8 Cols) */}
          <div className="lg:col-span-8">
            {selectedItem ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/95 p-6 shadow-2xl space-y-6 sticky top-6">
                
                {/* Header Banner */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${selectedItem.exploitability === 'CRITICAL' ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                        {selectedItem.exploitability || 'HIGH'} THREAT
                      </span>
                      {isAdmin && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800 flex items-center gap-1">
                          <ShieldAlert size={12} /> ACCOUNT TAKEOVER THREAT
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                      Target: {selectedItem.targetName}
                    </h2>
                    <p className="text-xs text-slate-400 font-mono">{comp.targetArn || selectedItem.targetId}</p>
                  </div>

                  <div className="text-right p-3 rounded-xl bg-slate-950 border border-slate-800 min-w-[120px]">
                    <div className="text-3xl font-black" style={{ color: selectedScoreColor }}>
                      {selectedScorePct}%
                    </div>
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Blast Radius Score</div>
                  </div>
                </div>

                {/* REACHABLE RESOURCES TILES MATRIX */}
                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                    <Layers size={14} className="text-amber-400" />
                    Reachable Resources Breakdown ({reachableCount} total downstream assets)
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(reachableByType).map(([type, count]) => (
                      <div key={type} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {renderTypeIcon(type)}
                          <span className="text-xs font-semibold text-slate-300">{TYPE_LABELS[type] || type}</span>
                        </div>
                        <span className="text-sm font-bold font-mono text-amber-300 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {count as number}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* MATHEMATICAL DAMAGE WEIGHT & FORMULA CALCULATION CARD */}
                <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 space-y-3">
                  <div className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2 border-b border-slate-800 pb-2">
                    <Calculator size={14} className="text-cyan-400" />
                    Mathematical Blast Radius Calculation
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-slate-400">
                        <span>Total Damage Weight:</span>
                        <strong className="font-mono text-cyan-300">≈ {totalDamageWeight}</strong>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Maximum Possible Damage:</span>
                        <strong className="font-mono text-slate-300">{maxPossibleDamage}</strong>
                      </div>
                    </div>

                    {/* Formula Equation Box */}
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-center text-xs">
                      <span className="text-slate-400">{totalDamageWeight}</span> / <span className="text-slate-400">{maxPossibleDamage}</span> × 100
                      <div className="text-base font-black mt-0.5" style={{ color: selectedScoreColor }}>
                        = {selectedScorePct}%
                      </div>
                    </div>
                  </div>

                  {/* Damage Progression Bar */}
                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                      <span>Damage Progression</span>
                      <span>{selectedScorePct}% / 100%</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(selectedScorePct, 100)}%`, backgroundColor: selectedScoreColor }}
                      />
                    </div>
                  </div>
                </div>

                {/* THREAT IMPACT GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <ShieldAlert size={12} className="text-red-400" /> Crown Jewels
                    </div>
                    <div className={`text-sm font-bold ${sensitiveCount > 0 ? 'text-red-400' : 'text-slate-300'}`}>
                      {sensitiveCount} sensitive asset(s)
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Shield size={12} className="text-cyan-400" /> Compromise Scope
                    </div>
                    <div className={`text-xs font-bold ${isAdmin ? 'text-red-400' : 'text-emerald-400'}`}>
                      {isAdmin ? 'FULL ACCOUNT TAKEOVER' : 'ISOLATED ASSET'}
                    </div>
                  </div>
                </div>

                {/* HOP CHAIN STEPPER */}
                {selectedItem.hops && selectedItem.hops.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Exploit Hop Chain Stepper</div>
                    <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-thin">
                      {selectedItem.hops.map((h: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 shrink-0">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[11px] text-purple-300">
                            {h.source_name || h.source_id}
                          </span>
                          <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
                            <ArrowRight size={10} /> {h.edge_type}
                          </span>
                          {idx === selectedItem.hops.length - 1 && (
                            <span className="px-2.5 py-1 rounded-lg bg-red-950 border border-red-800 font-mono text-[11px] text-red-300 font-bold">
                              {h.target_name || h.target_id}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ) : (
              <div className="p-16 rounded-2xl border border-slate-800 bg-slate-900/60 text-center text-xs text-slate-400">
                Select a target on the left panel to inspect its Blast Radius breakdown.
              </div>
            )}
          </div>

        </div>
      )}
    </PageLayout>
  )
}
