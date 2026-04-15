'use client'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

function tryParse(s: string) {
  try { return JSON.parse(s) } catch { return null }
}

export function AttackPathCard({ path }: { path: any }) {
  const [open, setOpen] = useState(false)
  const nar = tryParse(path.ai_narrative)

  const sev: Record<string, string> = {
    CRITICAL: 'border-red-500 bg-red-950/30',
    HIGH:     'border-orange-500 bg-orange-950/30',
    MEDIUM:   'border-yellow-500 bg-yellow-950/30',
    LOW:      'border-blue-500 bg-blue-950/30',
  }
  const badge: Record<string, string> = {
    CRITICAL: 'bg-red-600',
    HIGH:     'bg-orange-600',
    MEDIUM:   'bg-yellow-600 text-black',
    LOW:      'bg-blue-600',
  }

  return (
    <div className={`border-l-4 rounded-lg p-4 mb-3 ${sev[path.exploitability] || ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <span className={`text-xs font-bold px-2 py-0.5 rounded mr-2 text-white ${badge[path.exploitability] || 'bg-gray-600'}`}>
            {path.exploitability}
          </span>
          <span className="text-sm font-medium text-gray-200">→ {path.target_name}</span>
          <div className="text-xs text-gray-500 mt-1">
            {path.hop_count} steps · Score {path.score?.toFixed(2)} · Blast {path.blast_radius?.toFixed(0)}%
          </div>
          {nar?.headline && (
            <p className="text-gray-300 text-sm mt-2 italic">{nar.headline}</p>
          )}
        </div>
        <button onClick={() => setOpen(!open)} className="text-gray-600 hover:text-gray-300 ml-2">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          {nar && (
            <div className="bg-gray-800/60 rounded-lg p-3 text-sm space-y-2">
              {nar.story          && <p className="text-gray-300">{nar.story}</p>}
              {nar.business_impact && <p className="text-orange-300">⚠️ {nar.business_impact}</p>}
              {nar.fix            && (
                <p className="text-green-300">
                  ✅ Fix: {nar.fix}
                  {nar.fix_time && ` (${nar.fix_time})`}
                </p>
              )}
              {nar.attacker_difficulty && (
                <p className="text-gray-500 text-xs">
                  Attacker difficulty: {nar.attacker_difficulty} · Time to exploit: {nar.time_to_exploit}
                </p>
              )}
            </div>
          )}
          <div className="space-y-1">
            {path.hops?.map((h: any, i: number) => (
              <div key={i} className="flex gap-2 text-xs text-gray-400">
                <span className="text-gray-600 shrink-0">{i + 1}.</span>
                <span>{h.description}</span>
                <span className="text-gray-600 ml-auto">{h.edge_type} · {h.weight}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}