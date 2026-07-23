'use client'

import { PageLayout } from '@/components/PageLayout'

const sections = [
  {
    title: 'What Canopy Does',
    body: [
      'Canopy is a cloud security analytics dashboard built to help AWS operators and security teams identify their attack surface, chained access paths, and blast radius impact in a single view.',
      'It connects to your AWS account using an assumed role, inspects resources and attached policies, builds a resource-access graph, and surfaces multi-hop attacker paths with severity scoring.',
    ],
  },
  {
    title: 'How to Get Started',
    body: [
      '1. Navigate to the Connect page to add your AWS account. Enter a valid IAM role ARN that Canopy can assume via STS. This role should have read-only permissions for resource and policy discovery.',
      '2. After the connection is established, go to the Dashboard and start a scan. Canopy discovers AWS resources, evaluates policies, and computes the relationships that form attack paths.',
      '3. The scan runs asynchronously. Monitor the Dashboard for scan status, and wait until the status changes to complete before exploring the detailed results pages.',
    ],
  },
  {
    title: 'Dashboard Overview',
    body: [
      'The Dashboard is the application homepage and your primary control panel. It summarizes AWS resource counts, critical attack chain totals, graph edge totals, overall risk score, and scan timing.',
      'Use it to answer: has Canopy found any high-risk attack paths? Is the current scan up to date? Does the environment require immediate remediation?',
    ],
  },
  {
    title: 'Attack Paths',
    body: [
      'This page lists discovered attacker chains ranked by exploitability. Each path is a sequence of resources or principals that an attacker could use to move from an initial compromise to a sensitive target.',
      'Focus on CRITICAL and HIGH exploitability paths first. These are the ones most likely to be exploited and most dangerous to your environment.',
    ],
  },
  {
    title: 'Resource Graph',
    body: [
      'The Resource Graph visualizes resources and their security relationships. Nodes represent resources and the edges represent access or trust connections between them.',
      'This graph helps you understand attacker movement: a dense cluster indicates many related resources, while long chains indicate deeper access paths.',
    ],
  },
  {
    title: 'IAM Analyzer',
    body: [
      'The IAM Analyzer inspects principals, roles, and trust relationships in your AWS account.',
      'Use it to identify overprivileged roles, cross-account trust, and paths where a principal can assume another role. This page is essential for understanding how identity and access patterns contribute to attacker movement.',
    ],
  },
  {
    title: 'Blast Radius',
    body: [
      'The Blast Radius page shows how much impact a successful compromise has on your environment.',
      'The radar-style visualization places the Internet node at the center, with affected resources shown as dots arranged by blast radius. More dangerous resources appear farther from the center and use stronger severity colors.',
      'Use zoom, hover, and click interactions to inspect individual resources and understand which targets deserve the most urgent remediation.',
    ],
  },
  {
    title: 'AI Reports',
    body: [
      'AI Reports provides narrative summaries of the highest-risk attack paths and recommended next steps.',
      'These summaries help you interpret the output faster and communicate risk to stakeholders without manual analysis.',
    ],
  },
  {
    title: 'Best Practices',
    body: [
      'Prioritize the highest-risk paths first. Critical paths with broad blast radius are the most urgent.',
      'Use the Resource Graph and IAM Analyzer together: if a resource appears in a critical path, inspect its access relationships and the IAM roles that enable that access.',
      'Keep trust boundaries narrow, remove unused permissions, and use least privilege across IAM roles and policies.',
    ],
  },
  {
    title: 'Troubleshooting',
    body: [
      'If the Docs or other pages do not load, make sure the frontend can reach the backend API URL configured in `NEXT_PUBLIC_API_URL`.',
      'If logout or auth fails, verify that Clerk is properly configured and that the current user session is active.',
      'If scans do not show results, restart the scan from the Dashboard and refresh the page after the backend returns updated data.',
    ],
  },
]

export default function DocsPage() {
  return (
    <PageLayout title="Docs" subtitle="Complete guide to using Canopy">
      <div style={{ maxWidth: 980, display: 'grid', gap: 24 }}>
        {sections.map((section) => (
          <section key={section.title} style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 14, padding: 22 }}>
            <h2 style={{ color: '#9fbcd0', fontSize: 18, marginBottom: 12 }}>{section.title}</h2>
            {section.body.map((line, index) => (
              <p key={index} style={{ color: '#cfddee', fontSize: 14, lineHeight: 1.8, marginBottom: 10 }}>
                {line}
              </p>
            ))}
          </section>
        ))}
        <section style={{ background: '#0a1929', border: '1px solid #1a2d45', borderRadius: 14, padding: 22 }}>
          <h2 style={{ color: '#9fbcd0', fontSize: 18, marginBottom: 12 }}>Page Quick Reference</h2>
          <ul style={{ color: '#cfddee', fontSize: 14, lineHeight: 1.8, paddingLeft: 18 }}>
            <li><strong>Dashboard:</strong> scan state, risk metrics, and launch new scans.</li>
            <li><strong>Resource Graph:</strong> visualize the cloud security graph and access topology.</li>
            <li><strong>Attack Paths:</strong> view ranked attacker chains and exploitability details.</li>
            <li><strong>Resources:</strong> inspect resource-level data returned by the scan.</li>
            <li><strong>IAM Analyzer:</strong> analyze trust relationships and identity-based access.</li>
            <li><strong>Blast Radius:</strong> assess the impact of a breach with interactive radar visualization.</li>
            <li><strong>AI Reports:</strong> read narrative insights and remediation suggestions.</li>
          </ul>
        </section>
      </div>
    </PageLayout>
  )
}
