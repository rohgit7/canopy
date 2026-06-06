'use client'
import { useEffect, useRef } from 'react'
import cytoscape from 'cytoscape'

const TYPE_COLORS: Record<string, string> = {
  'ec2:instance':      '#ff9900',
  's3:bucket':         '#7aa116',
  'iam:role':          '#8c4fff',
  'iam:user':          '#b088ff',
  'lambda:function':   '#ec7211',
  'ec2:security_group':'#146eb4',
  'pseudo:internet':   '#d13212',
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
              n.data('is_sensitive') ? '#d13212'
              : n.data('internet_facing') ? '#ff9900'
              : '#68778d',
          } as any,
        },
        {
          selector: 'edge',
          style: {
            width:                (e: any) => Math.max(1, 4 - e.data('weight') * 3),
            'line-color':         (e: any) => e.data('weight') < 0.3 ? '#d13212' : '#4d5f75',
            'target-arrow-color': (e: any) => e.data('weight') < 0.3 ? '#d13212' : '#4d5f75',
            'target-arrow-shape': 'triangle',
            'curve-style':        'bezier',
          } as any,
        },
        {
          selector: '.attack-path',
          style: {
            'line-color':         '#d13212',
            width:                4,
            'target-arrow-color': '#d13212',
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
