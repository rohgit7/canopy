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
          data: { id: n.id, label: (n.name || n.id).substring(0, 20), ...n },
        })),
        ...linksToRender.map((e: any, i: number) => ({
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
            'font-size':         '10px',
            'font-weight':       '600',
            'text-valign':       'bottom',
            'text-margin-y':     6,
            'text-halign':       'center',
            width:               (n: any) => (n.data('type') === 'pseudo:internet' ? 44 : 36),
            height:              (n: any) => (n.data('type') === 'pseudo:internet' ? 44 : 36),
            'border-width':      3,
            'border-color':      (n: any) =>
              n.data('type') === 'pseudo:internet' ? '#d13212'
              : n.data('is_sensitive') ? '#d13212'
              : '#ff9900',
          } as any,
        },
        {
          selector: 'edge',
          style: {
            width:                4,
            'line-color':         '#d13212',
            'target-arrow-color': '#d13212',
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
            initialTemp: 200,
            coolingFactor: 0.99,
            idealEdgeLength: 80,
            nodeOverlap: 20,
          } as any,
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
  }, [data, attackPaths, isolatePath])

  return <div ref={ref} className="w-full h-full" />
}
