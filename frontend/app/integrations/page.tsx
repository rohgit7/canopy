import { PageLayout } from '@/components/PageLayout'

const INTEGRATIONS = [
  { name: 'AWS CloudTrail', desc: 'Stream real-time events and detect configuration changes as they happen.', icon: 'ti-activity', color: '#ff9800', status: 'coming_soon' },
  { name: 'AWS Config',     desc: 'Continuous compliance monitoring and resource configuration history.', icon: 'ti-settings-2', color: '#4fc3f7', status: 'coming_soon' },
  { name: 'Slack',          desc: 'Receive instant alerts when new critical attack paths are detected.', icon: 'ti-brand-slack', color: '#4caf50', status: 'coming_soon' },
  { name: 'PagerDuty',      desc: 'Automatically page on-call engineers for critical security findings.', icon: 'ti-bell-ringing', color: '#ef5350', status: 'coming_soon' },
  { name: 'Jira',           desc: 'Create tickets automatically for each attack path finding.', icon: 'ti-brand-asana', color: '#8b5cf6', status: 'coming_soon' },
  { name: 'GitHub Actions', desc: 'Run Canopy scans as part of your CI/CD pipeline on every deploy.', icon: 'ti-brand-github', color: '#b0bec5', status: 'coming_soon' },
]

export default function IntegrationsPage() {
  return (
    <PageLayout title="Integrations" subtitle="Connect Canopy to your existing tools and workflows">
      <div style={{ background: '#0a1929', border: '1px solid #1a2d45', borderLeft: '4px solid #ff9800', borderRadius: 8, padding: 14, marginBottom: 24, fontSize: 12, color: '#ff9800' }}>
        <i className="ti ti-tool" style={{ marginRight: 8 }} />
        Integrations are coming in the next release. The list below shows planned connectors.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {INTEGRATIONS.map(intg => (
          <div key={intg.name} style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 8, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 8, background: '#0f2236', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`ti ${intg.icon}`} style={{ fontSize: 20, color: intg.color }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#e1f5fe' }}>{intg.name}</div>
                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: '#0f2236', color: '#455a64' }}>COMING SOON</span>
              </div>
            </div>
            <p style={{ fontSize: 11, color: '#607d8b', lineHeight: 1.6, margin: 0 }}>{intg.desc}</p>
          </div>
        ))}
      </div>
    </PageLayout>
  )
}