'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp, Eye, ShieldAlert, Sparkles, ArrowRight } from 'lucide-react'

function tryParse(s: string) {
  try { return JSON.parse(s) } catch { return null }
}

export function AttackPathCard({
  path,
  isSelected,
  onSelect
}: {
  path: any
  isSelected?: boolean
  onSelect?: () => void
}) {
  const [open, setOpen] = useState(isSelected)
  const nar = tryParse(path.ai_narrative)

  const tone: Record<string, { accent: string; bg: string; badge: string; text: string }> = {
    CRITICAL: { accent: 'var(--red)', bg: 'rgba(209, 50, 18, .11)', badge: 'rgba(209, 50, 18, .2)', text: '#ffd7cd' },
    HIGH: { accent: 'var(--orange)', bg: 'rgba(255, 153, 0, .1)', badge: 'rgba(255, 153, 0, .2)', text: '#ffe1b2' },
    MEDIUM: { accent: 'var(--blue)', bg: 'rgba(20, 110, 180, .12)', badge: 'rgba(20, 110, 180, .22)', text: '#cbe8ff' },
    LOW: { accent: 'var(--green)', bg: 'rgba(122, 161, 22, .12)', badge: 'rgba(122, 161, 22, .2)', text: '#e7f5ba' },
  }
  const current = tone[path.exploitability] || tone.LOW

  return (
    <div
      onClick={onSelect}
      className="mb-3 rounded-lg p-4 cursor-pointer transition-all duration-200"
      style={{
        border: isSelected ? `2px solid ${current.accent}` : '1px solid var(--border)',
        borderLeft: `4px solid ${current.accent}`,
        background: isSelected ? 'rgba(15, 23, 42, 0.9)' : current.bg,
        boxShadow: isSelected ? `0 0 16px ${current.badge}` : 'none'
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-bold"
              style={{ background: current.badge, color: current.text }}
            >
              {path.exploitability}
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Target: {path.target_name || path.target_id}
            </span>
            {isSelected && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500 text-slate-950 flex items-center gap-1">
                <Eye size={10} /> HIGHLIGHTED
              </span>
            )}
          </div>

          <div className="mt-1 text-xs flex items-center gap-3" style={{ color: 'var(--text-dim)' }}>
            <span>{path.hop_count} hops</span>
            <span>-</span>
            <span>Score: {path.score?.toFixed(0)}/100</span>
            <span>-</span>
            <span className="text-orange-400">Blast Radius: {path.blast_radius?.toFixed(0)}%</span>
          </div>

          {/* Visual Hop Chain Stepper */}
          {path.hops && path.hops.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 overflow-x-auto py-1.5 scrollbar-thin">
              {path.hops.map((h: any, idx: number) => (
                <div key={idx} className="flex items-center gap-1.5 shrink-0">
                  <div
                    className="px-2 py-1 rounded text-[11px] font-mono border flex items-center gap-1"
                    style={{
                      background: idx === 0 ? 'rgba(209, 50, 18, 0.15)' : 'rgba(30, 41, 59, 0.7)',
                      borderColor: idx === 0 ? 'rgba(209, 50, 18, 0.4)' : '#334155',
                      color: idx === 0 ? '#ff8a75' : '#cbd5e1'
                    }}
                  >
                    {h.source_name || h.source_id?.substring(0, 14)}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-amber-400 px-0.5">
                    <ArrowRight size={12} />
                    <span className="opacity-80">{h.edge_type}</span>
                  </div>
                  {idx === path.hops.length - 1 && (
                    <div
                      className="px-2 py-1 rounded text-[11px] font-mono border font-semibold"
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        borderColor: '#ef4444',
                        color: '#fca5a5'
                      }}
                    >
                      {h.target_name || h.target_id?.substring(0, 14)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {nar?.headline && (
            <p className="mt-2 text-xs italic flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
              <Sparkles size={12} className="text-amber-400 shrink-0" />
              {nar.headline}
            </p>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation()
            setOpen(!open)
          }}
          className="ml-2 rounded-md p-1.5 hover:bg-slate-800/60"
          style={{ color: 'var(--text-muted)' }}
          aria-label={open ? 'Collapse attack path' : 'Expand attack path'}
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 pt-2 border-t border-slate-800/80">
          {nar && (
            <div className="space-y-2 rounded-lg p-3 text-xs" style={{ background: 'rgba(5, 15, 27, .65)', border: '1px solid var(--border)' }}>
              {nar.story && <p style={{ color: 'var(--text)' }}>{nar.story}</p>}
              {nar.business_impact && <p className="font-medium" style={{ color: 'var(--orange)' }}>Impact: {nar.business_impact}</p>}
              {nar.fix && (
                <p className="font-medium" style={{ color: 'var(--green)' }}>
                  Fix: {nar.fix}
                  {nar.fix_time && ` (${nar.fix_time})`}
                </p>
              )}
              {nar.attacker_difficulty && (
                <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  Attacker difficulty: {nar.attacker_difficulty} - Time to exploit: {nar.time_to_exploit}
                </p>
              )}
            </div>
          )}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Exploit Sequence Steps</div>
            {path.hops?.map((h: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs p-1.5 rounded bg-slate-900/50 border border-slate-800" style={{ color: 'var(--text-muted)' }}>
                <span className="shrink-0 font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 text-[10px]">{i + 1}</span>
                <span className="flex-1">{h.description}</span>
                <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-cyan-400">{h.edge_type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

