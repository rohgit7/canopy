'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

function tryParse(s: string) {
  try { return JSON.parse(s) } catch { return null }
}

export function AttackPathCard({ path }: { path: any }) {
  const [open, setOpen] = useState(false)
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
      className="mb-3 rounded-lg p-4"
      style={{ border: '1px solid var(--border)', borderLeft: `4px solid ${current.accent}`, background: current.bg }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <span
            className="mr-2 rounded-full px-2 py-0.5 text-xs font-bold"
            style={{ background: current.badge, color: current.text }}
          >
            {path.exploitability}
          </span>
          <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            to {path.target_name}
          </span>
          <div className="mt-1 text-xs" style={{ color: 'var(--text-dim)' }}>
            {path.hop_count} steps - Score {path.score?.toFixed(2)} - Blast {path.blast_radius?.toFixed(0)}%
          </div>
          {nar?.headline && (
            <p className="mt-2 text-sm italic" style={{ color: 'var(--text-muted)' }}>{nar.headline}</p>
          )}
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="ml-2 rounded-md p-1"
          style={{ color: 'var(--text-muted)' }}
          aria-label={open ? 'Collapse attack path' : 'Expand attack path'}
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          {nar && (
            <div className="space-y-2 rounded-lg p-3 text-sm" style={{ background: 'rgba(5, 15, 27, .55)', border: '1px solid var(--border)' }}>
              {nar.story && <p style={{ color: 'var(--text)' }}>{nar.story}</p>}
              {nar.business_impact && <p style={{ color: 'var(--orange)' }}>Impact: {nar.business_impact}</p>}
              {nar.fix && (
                <p style={{ color: 'var(--green)' }}>
                  Fix: {nar.fix}
                  {nar.fix_time && ` (${nar.fix_time})`}
                </p>
              )}
              {nar.attacker_difficulty && (
                <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                  Attacker difficulty: {nar.attacker_difficulty} - Time to exploit: {nar.time_to_exploit}
                </p>
              )}
            </div>
          )}
          <div className="space-y-1">
            {path.hops?.map((h: any, i: number) => (
              <div key={i} className="flex gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span className="shrink-0" style={{ color: 'var(--text-dim)' }}>{i + 1}.</span>
                <span>{h.description}</span>
                <span className="ml-auto" style={{ color: 'var(--text-dim)' }}>{h.edge_type} - {h.weight}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
