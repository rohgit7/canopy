'use client'
import { useState, useEffect } from 'react'
import { useAuth, UserButton } from '@clerk/nextjs'
import { Shield, LogOut } from 'lucide-react'
import { SecurityGraph }  from '@/components/SecurityGraph'
import { AttackPathCard } from '@/components/AttackPathCard'

const API = process.env.NEXT_PUBLIC_API_URL

export default function Dashboard() {
  const { getToken } = useAuth()
  const [scanId,    setScanId]   = useState<string | null>(null)
  const [scanning,  setScanning] = useState(false)
  const [results,   setResults]  = useState<any>(null)
  const [progress,  setProgress] = useState('')
  const [error,     setError]    = useState<string | null>(null)

  const scan = async () => {
    setScanning(true)
    setError(null)
    setResults(null)
    setProgress('Connecting to your AWS account...')

    try {
      const token = await getToken()
      const r     = await fetch(`${API}/scan`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ customer_id: 'me' }),
      })
      const data = await r.json()
      setScanId(data.scan_id)
    } catch {
      setError('Cannot reach API. Is the backend running on port 8000?')
      setScanning(false)
    }
  }

  useEffect(() => {
    if (!scanId || !scanning) return

    const messages = [
      'Extracting IAM roles and policies...',
      'Scanning EC2 instances across regions...',
      'Checking S3 buckets and Lambda functions...',
      'Building resource graph...',
      'Evaluating IAM policies...',
      'Running attack path algorithm...',
      'Calculating blast radius...',
      'Generating AI explanations...',
    ]
    let idx      = 0
    const msgInt = setInterval(() => {
      setProgress(messages[idx++ % messages.length])
    }, 8000)

    const pollInt = setInterval(async () => {
      try {
        const r    = await fetch(`${API}/scan/${scanId}`)
        const data = await r.json()

        if (data.status === 'complete') {
          setResults(data)
          setScanning(false)
          clearInterval(msgInt)
          clearInterval(pollInt)
        } else if (data.status === 'failed') {
          setError(data.error || 'Scan failed')
          setScanning(false)
          clearInterval(msgInt)
          clearInterval(pollInt)
        }
      } catch { /* keep polling */ }
    }, 3000)

    return () => {
      clearInterval(msgInt)
      clearInterval(pollInt)
    }
  }, [scanId, scanning])

  const score    = results?.score ?? null
  const scoreCol = score === null ? 'gray'
    : score >= 80 ? 'green'
    : score >= 50 ? 'yellow'
    : 'red'

  const colMap: Record<string, string> = {
    green:  'text-green-400 border-green-500',
    yellow: 'text-yellow-400 border-yellow-500',
    red:    'text-red-400 border-red-500',
    gray:   'text-gray-400 border-gray-600',
  }

  return (
    <div className="min-h-screen bg-gray-950 p-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-blue-400" />
          <span className="text-xl font-bold">Canopy</span>
          <span className="text-gray-500 text-sm">Cloud Security Intelligence</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={scan}
            disabled={scanning}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 px-5 py-2 rounded-lg font-medium transition"
          >
            {scanning ? '⏳ Scanning...' : '🔍 Scan Account'}
          </button>
        </div>
      </div>

      {/* Progress */}
      {scanning && (
        <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-6 mb-6 text-center">
          <div className="text-blue-300 font-medium mb-1">{progress}</div>
          <div className="text-gray-500 text-sm">Scan takes 1–3 minutes. Page auto-updates.</div>
          <div className="mt-3 h-1 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-800 rounded-xl p-4 mb-6 text-red-300">
          {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <>
          {/* Score cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className={`bg-gray-900 rounded-xl p-5 border-l-4 ${colMap[scoreCol].split(' ')[1]}`}>
              <div className="text-gray-400 text-sm mb-1">Security Score</div>
              <div className={`text-5xl font-bold ${colMap[scoreCol].split(' ')[0]}`}>
                {score?.toFixed(0)}
              </div>
              <div className="text-gray-600 text-sm">/ 100</div>
            </div>
            <Stat label="Attack Paths" value={results.attack_paths?.length ?? 0} color="red" />
            <Stat label="Resources"    value={results.resource_count ?? 0}       color="blue" />
            <Stat label="Graph Edges"  value={results.edge_count ?? 0}           color="purple" />
          </div>

          {/* Graph + Paths */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-900 rounded-xl p-4 h-[480px]">
              <h2 className="font-semibold mb-3 text-gray-200">Resource Graph</h2>
              {results.graph_data && (
                <SecurityGraph
                  data={results.graph_data}
                  attackPaths={results.attack_paths}
                />
              )}
            </div>
            <div className="bg-gray-900 rounded-xl p-4 h-[480px] overflow-y-auto">
              <h2 className="font-semibold mb-3 text-gray-200">
                Attack Paths ({results.attack_paths?.length ?? 0})
              </h2>
              {results.attack_paths?.length === 0 && (
                <div className="text-green-400 text-center py-12">
                  🎉 No attack paths found! Excellent security posture.
                </div>
              )}
              {results.attack_paths?.map((path: any, i: number) => (
                <AttackPathCard key={i} path={path} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!results && !scanning && !error && (
        <div className="text-center py-24 text-gray-600">
          <Shield className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p>Click Scan Account to analyse your AWS security posture</p>
          <p className="text-sm mt-2">
            New user?{' '}
            <a href="/connect" className="text-blue-400 hover:underline">
              Connect your account first
            </a>
          </p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: any; color: string }) {
  const c: Record<string, string> = {
    red:    'text-red-400',
    blue:   'text-blue-400',
    purple: 'text-purple-400',
  }
  return (
    <div className="bg-gray-900 rounded-xl p-5">
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div className={`text-4xl font-bold ${c[color]}`}>{value}</div>
    </div>
  )
}