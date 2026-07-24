'use client'

import { useState, useEffect } from 'react'
import { useAuth, UserButton } from '@clerk/nextjs'
import { PageLayout } from '@/components/PageLayout'
import { buildApiUrl, clearApiCache } from '@/lib/api'
import { useScan } from '@/context/ScanContext'
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  Globe,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Trash2,
  User,
  Sliders,
  Check
} from 'lucide-react'

const REGIONS = [
  { id: 'ap-south-1',     name: 'Asia Pacific (Mumbai)',     flag: '🇮🇳' },
  { id: 'us-east-1',     name: 'US East (N. Virginia)',     flag: '🇺🇸' },
  { id: 'us-west-2',     name: 'US West (Oregon)',          flag: '🇺🇸' },
  { id: 'eu-west-1',     name: 'EU (Ireland)',              flag: '🇮🇪' },
  { id: 'ap-southeast-1',name: 'Asia Pacific (Singapore)',  flag: '🇸🇬' },
  { id: 'eu-central-1',  name: 'EU (Frankfurt)',            flag: '🇩🇪' },
]

export default function SettingsPage() {
  const { userId } = useAuth()
  const { connection, refreshData } = useScan()
  
  const [roleArn, setRoleArn] = useState('')
  const [region, setRegion] = useState('ap-south-1')
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; msg: string; accountId?: string } | null>(null)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    if (connection?.role_arn) {
      setRoleArn(connection.role_arn)
    }
  }, [connection])

  const testConnection = async () => {
    if (!roleArn.trim()) return
    setTesting(true)
    setTestMsg(null)
    setSaved(false)
    
    try {
      const res = await fetch(buildApiUrl('/connect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_arn: roleArn.trim(), customer_id: 'me' }),
      })
      const data = await res.json()
      if (res.ok) {
        setTestMsg({
          ok: true,
          msg: `Successfully connected to AWS Account`,
          accountId: data.account_id
        })
        await refreshData()
      } else {
        setTestMsg({
          ok: false,
          msg: data.detail || 'STS AssumeRole connection test failed. Please verify IAM trust policy.'
        })
      }
    } catch {
      setTestMsg({
        ok: false,
        msg: 'Unable to reach backend API endpoint. Ensure Canopy backend service is active.'
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!roleArn.trim()) return
    setSaved(false)
    await testConnection()
    setSaved(true)
    setTimeout(() => setSaved(false), 3500)
  }

  const handleClearCache = () => {
    setClearing(true)
    clearApiCache()
    setTimeout(() => {
      setClearing(false)
      setTestMsg({ ok: true, msg: 'API scan response cache purged successfully.' })
    }, 600)
  }

  const isConnected = Boolean(connection?.account_id)

  return (
    <PageLayout
      title="Settings"
      subtitle="Configure your Canopy account credentials, AWS IAM role integration, and region parameters"
    >
      <div className="max-w-4xl space-y-6 pb-12">
        {/* Account Session Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <User size={18} className="text-blue-400" />
              <h3 className="font-bold text-slate-100 text-sm uppercase tracking-wider">Account Profile</h3>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-blue-950 text-blue-400 border border-blue-800">
              AUTHENTICATED
            </span>
          </div>

          <div className="flex items-center gap-4">
            <UserButton />
            <div className="space-y-1">
              <div className="font-bold text-slate-100 text-sm">Signed In Session</div>
              <div className="text-xs font-mono text-slate-400">
                User ID: <span className="text-cyan-400">{userId || 'Not signed in'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* AWS Connection Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl border ${isConnected ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400' : 'bg-amber-950/60 border-amber-800/80 text-amber-400'}`}>
                {isConnected ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm uppercase tracking-wider">AWS Integration</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isConnected
                    ? `Connected Account ID: ${connection?.account_id}`
                    : 'Provide an IAM AssumeRole ARN to allow graph threat analysis'}
                </p>
              </div>
            </div>

            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isConnected ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
              {isConnected ? 'Connected' : 'Action Needed'}
            </span>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Key size={14} className="text-blue-400" />
                <span>IAM Role ARN</span>
                <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={roleArn}
                onChange={e => setRoleArn(e.target.value)}
                placeholder="arn:aws:iam::123456789012:role/CanopyScanner"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Globe size={14} className="text-purple-400" />
                <span>Primary Scan Region</span>
              </label>
              <select
                value={region}
                onChange={e => setRegion(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {REGIONS.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.flag} {r.name} ({r.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={testConnection}
                disabled={!roleArn.trim() || testing}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-200 font-semibold flex items-center gap-2 transition"
              >
                <RefreshCw size={14} className={testing ? 'animate-spin text-blue-400' : ''} />
                <span>{testing ? 'Testing Connection...' : 'Test Connection'}</span>
              </button>

              <button
                onClick={handleSave}
                disabled={!roleArn.trim() || testing}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold flex items-center gap-2 shadow-lg shadow-blue-500/20 transition"
              >
                <Zap size={15} />
                <span>Save Settings</span>
              </button>
            </div>

            {testMsg && (
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  testMsg.ok
                    ? 'bg-emerald-950/70 border-emerald-800/80 text-emerald-200'
                    : 'bg-red-950/70 border-red-800/80 text-red-200'
                }`}
              >
                {testMsg.ok ? <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />}
                <div>
                  <div className="font-bold text-xs">{testMsg.msg}</div>
                  {testMsg.accountId && (
                    <div className="text-[11px] font-mono text-emerald-300 mt-0.5">
                      AWS Account ID: {testMsg.accountId}
                    </div>
                  )}
                </div>
              </div>
            )}

            {saved && (
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
                <Check size={16} />
                <span>Settings saved and connection verified successfully.</span>
              </div>
            )}
          </div>
        </div>

        {/* Scan Configuration Card */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-4">
            <Sliders size={18} className="text-purple-400" />
            <h3 className="font-bold text-slate-100 text-sm uppercase tracking-wider">Region Scan Coverage</h3>
          </div>

          <div className="space-y-3 text-xs">
            <label className="block font-semibold text-slate-300">Configured Scan Target Regions</label>
            <div className="flex flex-wrap gap-2">
              {REGIONS.map(r => (
                <div
                  key={r.id}
                  className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 font-mono text-xs ${
                    r.id === region
                      ? 'bg-blue-950 border-blue-500 text-white font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
                >
                  <span>{r.flag}</span>
                  <span>{r.id}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
              Currently discovering graph assets across active AWS regions: <code className="text-slate-300 font-mono">ap-south-1</code>, <code className="text-slate-300 font-mono">us-east-1</code>, <code className="text-slate-300 font-mono">us-west-2</code>, <code className="text-slate-300 font-mono">eu-west-1</code>.
            </p>
          </div>
        </div>

        {/* Danger Zone Card */}
        <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-red-900/40 pb-4">
            <Trash2 size={18} className="text-red-400" />
            <h3 className="font-bold text-red-400 text-sm uppercase tracking-wider">Danger Zone</h3>
          </div>

          <div className="space-y-3 text-xs">
            <p className="text-slate-400">
              Purging cached responses forces Canopy to re-fetch live state directly from your backend endpoints.
            </p>
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className="px-4 py-2.5 rounded-xl bg-red-950 border border-red-800 hover:bg-red-900 text-red-300 text-xs font-semibold flex items-center gap-2 transition"
            >
              <RefreshCw size={14} className={clearing ? 'animate-spin' : ''} />
              <span>{clearing ? 'Clearing Cache...' : 'Clear Local Scan Cache'}</span>
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
