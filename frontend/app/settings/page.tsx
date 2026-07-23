'use client'
import { useState } from 'react'
import { useAuth, UserButton } from '@clerk/nextjs'
import { PageLayout } from '@/components/PageLayout'
import { buildApiUrl } from '@/lib/api'

export default function SettingsPage() {
  const { userId } = useAuth()
  const [roleArn,  setRoleArn]  = useState('')
  const [region,   setRegion]   = useState('ap-south-1')
  const [saved,    setSaved]    = useState(false)
  const [testing,  setTesting]  = useState(false)
  const [testMsg,  setTestMsg]  = useState<{ok:boolean,msg:string}|null>(null)

  const REGIONS = ['ap-south-1','us-east-1','us-west-2','eu-west-1','ap-southeast-1','eu-central-1']

  const testConnection = async () => {
    if (!roleArn) return
    setTesting(true); setTestMsg(null)
    try {
      const r    = await fetch(buildApiUrl('/connect'), {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ role_arn: roleArn, customer_id: 'me' }),
      })
      const data = await r.json()
      setTestMsg(r.ok
        ? { ok: true,  msg: `Connected to account ${data.account_id}` }
        : { ok: false, msg: data.detail || 'Connection failed' }
      )
    } catch {
      setTestMsg({ ok: false, msg: 'Cannot reach API' })
    }
    setTesting(false)
  }

  const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 20, marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#607d8b', textTransform: 'uppercase', letterSpacing: '.7px', marginBottom: 16, paddingBottom: 10, borderBottom: '1px solid #1a2d45' }}>
        {title}
      </div>
      {children}
    </div>
  )

  const Label = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 11, color: '#607d8b', marginBottom: 6, marginTop: 14 }}>{children}</div>
  )

  const inputStyle = {
    width: '100%', background: '#07111f', border: '1px solid #1a2d45',
    borderRadius: 6, padding: '8px 12px', color: '#b0bec5', fontSize: 12,
    outline: 'none',
  }

  return (
    <PageLayout title="Settings" subtitle="Configure your Canopy account and AWS connection">

      <div style={{ maxWidth: 700 }}>

        {/* Account */}
        <Section title="Account">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <UserButton />
            <div>
              <div style={{ fontSize: 13, color: '#e1f5fe' }}>Signed in</div>
              <div style={{ fontSize: 11, color: '#455a64', marginTop: 2 }}>User ID: {userId?.substring(0,20)}...</div>
            </div>
          </div>
        </Section>

        {/* AWS Connection */}
        <Section title="AWS Connection">
          <Label>Role ARN</Label>
          <input
            value={roleArn}
            onChange={e => setRoleArn(e.target.value)}
            placeholder="arn:aws:iam::123456789012:role/CanopyScanner"
            style={{ ...inputStyle, fontFamily: 'monospace' }}
          />
          <Label>Primary Scan Region</Label>
          <select
            value={region}
            onChange={e => setRegion(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button onClick={testConnection} disabled={!roleArn || testing} style={{
              padding: '8px 16px', background: '#0f2236', border: '1px solid #1a2d45',
              borderRadius: 6, color: '#90caf9', fontSize: 12, cursor: 'pointer',
            }}>
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button onClick={() => setSaved(true)} style={{
              padding: '8px 16px', background: '#1565c0', border: 'none',
              borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer',
            }}>
              Save
            </button>
          </div>
          {testMsg && (
            <div style={{ marginTop: 10, fontSize: 12, padding: '8px 12px', borderRadius: 6, background: testMsg.ok ? 'rgba(122, 161, 22, .14)' : 'rgba(209, 50, 18, .14)', color: testMsg.ok ? 'var(--aws-storage)' : 'var(--aws-risk)', border: `1px solid ${testMsg.ok ? 'rgba(122, 161, 22, .28)' : 'rgba(209, 50, 18, .28)'}` }}>
              {testMsg.ok ? '✓ ' : '✗ '}{testMsg.msg}
            </div>
          )}
          {saved && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--aws-storage)' }}>✓ Settings saved</div>}
        </Section>

        {/* Scan settings */}
        <Section title="Scan Configuration">
          <Label>Regions to Scan</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {REGIONS.map(r => (
              <div key={r} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, background: '#0f2236', border: '1px solid #1a2d45', color: '#607d8b', cursor: 'pointer' }}>
                {r}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#37637a', marginTop: 8 }}>
            Region selection coming in a future update. Currently scanning: ap-south-1, us-east-1, us-west-2, eu-west-1.
          </p>
        </Section>

        {/* Danger zone */}
        <Section title="Danger Zone">
          <p style={{ fontSize: 12, color: '#607d8b', marginBottom: 12 }}>
            These actions are irreversible.
          </p>
          <button style={{ padding: '8px 16px', background: 'transparent', border: '1px solid var(--aws-risk)', borderRadius: 6, color: 'var(--aws-risk)', fontSize: 12, cursor: 'pointer' }}>
            Clear All Scan Data
          </button>
        </Section>

      </div>
    </PageLayout>
  )
}
