'use client'
import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'

const TYPE_COLORS: Record<string, string> = {
  'ec2:instance':      '#3b82f6',
  's3:bucket':         '#f59e0b',
  'iam:role':          '#8b5cf6',
  'iam:user':          '#a78bfa',
  'lambda:function':   '#f97316',
  'ec2:security_group':'#6b7280',
  'pseudo:internet':   '#ef4444',
}

export function SecurityGraph({
  data,
  attackPaths,
}: {
  data: any
  attackPaths: any[]
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || !data) return

    const cy = cytoscape({
      container: ref.current,
      elements: [
        ...data.nodes.map((n: any) => ({
          data: { id: n.id, label: (n.name || n.id).substring(0, 16), ...n },
        })),
        ...data.links.map((e: any, i: number) => ({
          data: { id: `e${i}`, source: e.source, target: e.target, ...e },
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            'background-color':  (n: any) => TYPE_COLORS[n.data('type')] || '#475569',
            label:               'data(label)',
            color:               '#e2e8f0',
            'font-size':         '9px',
            'text-valign':       'center',
            'text-halign':       'center',
            'text-wrap':         'wrap',
            'text-max-width':    '70px',
            width:               (n: any) =>
              n.data('internet_facing') || n.data('is_sensitive') ? 44 : 28,
            height:              (n: any) =>
              n.data('internet_facing') || n.data('is_sensitive') ? 44 : 28,
            'border-width':      (n: any) =>
              n.data('is_sensitive') ? 3 : n.data('internet_facing') ? 3 : 1,
            'border-color':      (n: any) =>
              n.data('is_sensitive') ? '#ef4444'
              : n.data('internet_facing') ? '#f97316'
              : '#475569',
          } as any,
        },
        {
          selector: 'edge',
          style: {
            width:                (e: any) => Math.max(1, 4 - e.data('weight') * 3),
            'line-color':         (e: any) => e.data('weight') < 0.3 ? '#ef4444' : '#374151',
            'target-arrow-color': (e: any) => e.data('weight') < 0.3 ? '#ef4444' : '#374151',
            'target-arrow-shape': 'triangle',
            'curve-style':        'bezier',
          } as any,
        },
        {
          selector: '.attack-path',
          style: {
            'line-color':         '#ef4444',
            width:                4,
            'target-arrow-color': '#ef4444',
          },
        },
      ],
      layout: { name: 'cose', animate: false, idealEdgeLength: 80 } as any,
    })

    if (attackPaths?.length > 0) {
      const ids = new Set(
        attackPaths[0].hops?.flatMap((h: any) => [h.source_id, h.target_id]) || []
      )
      cy.edges()
        .filter((e: any) => ids.has(e.data('source')) && ids.has(e.data('target')))
        .addClass('attack-path')
    }

    return () => cy.destroy()
  }, [data, attackPaths])

  return <div ref={ref} className="w-full h-full" />
}