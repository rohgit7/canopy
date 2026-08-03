'use client'
import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'

const NODE_TYPES: Record<string, { color: string; border: string; label: string }> = {
  'ec2:instance': { color: '#1d4ed8', border: '#3b82f6', label: 'EC2 Instance' },
  'ec2:security_group': { color: '#475569', border: '#64748b', label: 'Security Group' },
  's3:bucket': { color: '#f59e0b', border: '#fbbf24', label: 'S3 Bucket' },
  'iam:role': { color: '#7c3aed', border: '#a855f7', label: 'IAM Role' },
  'iam:user': { color: '#c084fc', border: '#d8b4fe', label: 'IAM User' },
  'lambda:function': { color: '#ea580c', border: '#fb923c', label: 'Lambda Function' },
  'apigateway:rest': { color: '#0ea5e9', border: '#38bdf8', label: 'API Gateway REST' },
  'apigateway:http': { color: '#14b8a6', border: '#2dd4bf', label: 'API Gateway HTTP' },
  'apigateway:websocket': { color: '#16a34a', border: '#4ade80', label: 'API Gateway WebSocket' },
  'rds:instance': { color: '#db2777', border: '#f472b6', label: 'RDS Instance' },
  'rds:cluster': { color: '#9333ea', border: '#c084fc', label: 'RDS Cluster' },
  'pseudo:internet': { color: '#ef4444', border: '#fb7185', label: 'Internet' },
}

const EDGE_TYPES: Record<string, { color: string; label: string }> = {
  'EXPOSES_PORT': { color: '#ef4444', label: 'Exposes Port' },
  'HAS_ROLE': { color: '#f97316', label: 'Has IAM Role' },
  'CAN_ASSUME': { color: '#eab308', label: 'Can Assume Role' },
  'CAN_ACCESS': { color: '#4fc3f7', label: 'Can Access' },
  'HAS_ENV_CREDS': { color: '#a78bfa', label: 'Has Env Credentials' },
  'ATTACHED_SG': { color: '#6b7280', label: 'Attached SG' },
}

export function SecurityGraph({
  data,
  attackPaths,
  isolatePath = false,
}: {
  data: any
  attackPaths: any[]
  isolatePath?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || !data) return

    let nodesToRender = data.nodes || []
    let linksToRender = data.links || []

    const pathNodeIds = (attackPaths?.length > 0 && attackPaths[0]?.hops)
      ? new Set(attackPaths[0].hops.flatMap((h: any) => [h.source_id, h.target_id]))
      : null

    if (isolatePath && pathNodeIds && pathNodeIds.size > 0) {
      nodesToRender = nodesToRender.filter((n: any) => pathNodeIds.has(n.id))
      linksToRender = linksToRender.filter((e: any) => pathNodeIds.has(e.source) && pathNodeIds.has(e.target))
    }

    const cy = cytoscape({
      container: ref.current,
      elements: [
        ...nodesToRender.map((n: any) => ({
          data: {
            id: String(n.id),
            label: (n.name || n.id).substring(0, 18),
            type: n.type,
            name: n.name,
            region: n.region,
            internet_facing: n.internet_facing,
            is_sensitive: n.is_sensitive,
            is_admin: n.is_admin,
            kind: 'node',
          },
        })),
        ...linksToRender.map((e: any, i: number) => ({
          data: {
            id: `e${i}`,
            source: String(e.source),
            target: String(e.target),
            edge_type: e.edge_type || '',
            weight: e.weight || 0.5,
            kind: 'edge',
          },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color': (n: any) => {
              const def = NODE_TYPES[n.data('type')]
              return def?.color || '#1a2d45'
            },
            'border-color': (n: any) => {
              if (n.data('is_admin')) return '#ff1744'
              if (n.data('is_sensitive')) return '#ef5350'
              if (n.data('internet_facing')) return '#f97316'
              return NODE_TYPES[n.data('type')]?.border || '#37637a'
            },
            'border-width': (n: any) =>
              n.data('is_admin') || n.data('is_sensitive') || n.data('internet_facing') ? 3 : 1.5,
            label: 'data(label)',
            color: '#94a3b8',
            'font-size': '10px',
            'font-family': 'monospace',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
            'text-wrap': 'wrap',
            'text-max-width': '80px',
            width: (n: any) => {
              if (n.data('type') === 'pseudo:internet') return 44
              if (n.data('is_admin') || n.data('is_sensitive')) return 36
              if (n.data('internet_facing')) return 32
              return 26
            },
            height: (n: any) => {
              if (n.data('type') === 'pseudo:internet') return 44
              if (n.data('is_admin') || n.data('is_sensitive')) return 36
              if (n.data('internet_facing')) return 32
              return 26
            },
          } as any,
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#00e5ff',
            'border-width': 4,
            'shadow-blur': 16,
            'shadow-color': '#00e5ff',
            'background-color': '#00838f',
          } as any,
        },
        {
          selector: 'edge',
          style: {
            width: (e: any) => Math.max(1, 3.5 - (e.data('weight') || 0.5) * 3),
            'line-color': (e: any) => EDGE_TYPES[e.data('edge_type')]?.color || '#1e3a5f',
            'target-arrow-color': (e: any) => EDGE_TYPES[e.data('edge_type')]?.color || '#1e3a5f',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          } as any,
        },
        {
          selector: '.attack-path',
          style: {
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            width: 4,
            'z-index': 999,
          },
        },
        {
          selector: '.dimmed',
          style: {
            opacity: 0.15,
          },
        },
        {
          selector: '.highlighted',
          style: {
            opacity: 1,
          },
        },
      ],
      layout: (isolatePath && pathNodeIds)
        ? {
          name: 'breadthfirst',
          directed: true,
          padding: 35,
          spacingFactor: 1.5,
        } as any
        : {
          name: 'cose',
          animate: false,
          randomize: false,
          numIter: 150,
          idealEdgeLength: 80,
          nodeOverlap: 20,
          padding: 30,
        } as any,
    })

    if (attackPaths?.length > 0) {
      const ids = new Set(
        attackPaths[0].hops?.flatMap((h: any) => [String(h.source_id), String(h.target_id)]) || []
      )
      cy.edges()
        .filter((e: any) => ids.has(String(e.data('source'))) && ids.has(String(e.data('target'))))
        .addClass('attack-path')
    }

    cy.on('tap', 'node', (evt: any) => {
      const n = evt.target
      cy.elements().removeClass('attack-path dimmed highlighted')
      cy.elements().addClass('dimmed')
      n.closedNeighborhood().removeClass('dimmed').addClass('highlighted')
    })

    cy.on('tap', (evt: any) => {
      if (evt.target === cy) {
        cy.elements().removeClass('dimmed highlighted')
      }
    })

    return () => cy.destroy()
  }, [data, attackPaths, isolatePath])

  return <div ref={ref} className="w-full h-full" />
}
