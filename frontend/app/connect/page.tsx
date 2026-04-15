'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { Shield, CheckCircle, AlertCircle, Copy } from 'lucide-react'

const API        = process.env.NEXT_PUBLIC_API_URL
const ACCOUNT_ID = process.env.NEXT_PUBLIC_CANOPY_ACCOUNT_ID || 'YOUR_ACCOUNT_ID'

export default function Connect() {
  const [roleArn, setRoleArn] = useState('')
  const [status,  setStatus]  = useState<'idle'|'verifying'|'ok'|'error'>('idle')
  const [msg,     setMsg]     = useState('')
  const { getToken }          = useAuth()
  const router                = useRouter()

  const verify = async () => {
    setStatus('verifying')
    try {
      const token = await getToken()
      const res   = await fetch(`${API}/connect`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ role_arn: roleArn, customer_id: 'me' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setMsg(data.detail || 'Connection failed')
        return
      }
      setStatus('ok')
      setMsg(`Connected to account ${data.account_id}`)
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch {
      setStatus('error')
      setMsg('Cannot reach API. Is the backend running?')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">

        <div className="text-center mb-10">
          <Shield className="w-12 h-12 text-blue-400 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">Connect Your AWS Account</h1>
          <p className="text-gray-400">Follow these 3 steps — takes about 3 minutes</p>
        </div>

        {/* Step 1 */}
        <div className="bg-gray-900 rounded-xl p-6 mb-4 border border-gray-800">
          <h2 className="font-bold text-lg mb-3">
            <span className="bg-blue-600 text-white rounded-full w-7 h-7 inline-flex items-center justify-center mr-2 text-sm">1</span>
            Open AWS Console → IAM → Roles → Create Role
          </h2>
          <ul className="text-gray-300 text-sm space-y-2 ml-9">
            <li>• Choose <strong>Another AWS account</strong></li>
            <li>• Account ID:
              <code className="bg-gray-800 px-2 py-0.5 rounded ml-1">{ACCOUNT_ID}</code>
              <button
                onClick={() => navigator.clipboard.writeText(ACCOUNT_ID)}
                className="ml-2 text-blue-400 hover:text-blue-300 text-xs"
              >
                <Copy className="w-3 h-3 inline" /> Copy
              </button>
            </li>
          </ul>
        </div>

        {/* Step 2 */}
        <div className="bg-gray-900 rounded-xl p-6 mb-4 border border-gray-800">
          <h2 className="font-bold text-lg mb-3">
            <span className="bg-blue-600 text-white rounded-full w-7 h-7 inline-flex items-center justify-center mr-2 text-sm">2</span>
            Attach these two policies and name the role CanopyScanner
          </h2>
          <div className="ml-9 space-y-2">
            {['SecurityAudit', 'ReadOnlyAccess'].map(pol => (
              <div key={pol} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                <code className="text-sm bg-gray-800 px-2 py-1 rounded">{pol}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
          <h2 className="font-bold text-lg mb-3">
            <span className="bg-blue-600 text-white rounded-full w-7 h-7 inline-flex items-center justify-center mr-2 text-sm">3</span>
            Paste your Role ARN
          </h2>
          <input
            value={roleArn}
            onChange={e => setRoleArn(e.target.value)}
            placeholder="arn:aws:iam::123456789012:role/CanopyScanner"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 font-mono text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={verify}
          disabled={!roleArn || status === 'verifying'}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 py-3 rounded-xl font-semibold transition text-lg"
        >
          {status === 'verifying' ? '⏳ Verifying...' : '✓  Verify & Connect'}
        </button>

        {status === 'ok' && (
          <div className="mt-4 bg-green-900/40 border border-green-700 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="text-green-400 shrink-0" />
            <span className="text-green-300">{msg} — redirecting...</span>
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 bg-red-900/40 border border-red-700 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="text-red-400 shrink-0" />
            <span className="text-red-300">{msg}</span>
          </div>
        )}
      </div>
    </div>
  )
}