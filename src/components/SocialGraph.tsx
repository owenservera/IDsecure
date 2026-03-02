'use client';

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { SearchResult } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Network } from 'lucide-react';

interface SocialGraphProps {
  results: SearchResult[];
  subjectName?: string;
}

interface Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: 'subject' | 'profile';
  platform?: string;
  confidence?: number;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  source: string;
  target: string;
}

export function SocialGraph({ results, subjectName }: SocialGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || results.length === 0) return;

    const width = 600;
    const height = 400;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const nodes: Node[] = [
      { id: 'subject', label: subjectName || 'Subject', type: 'subject' }
    ];

    const links: Link[] = [];

    results.forEach((r, i) => {
      const id = `profile_${i}`;
      nodes.push({
        id,
        label: r.platform,
        type: 'profile',
        platform: r.platform,
        confidence: r.confidence
      });
      links.push({ source: 'subject', target: id });
    });

    const simulation = d3.forceSimulation<Node>(nodes)
      .force('link', d3.forceLink<Node, Link>(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2));

    const g = svg.append('g');

    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1);

    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any);

    node.append('circle')
      .attr('r', d => d.type === 'subject' ? 20 : 12)
      .attr('fill', d => d.type === 'subject' ? '#6366f1' : '#ec4899')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    node.append('text')
      .attr('dx', 15)
      .attr('dy', 4)
      .text(d => d.label)
      .attr('font-size', '10px')
      .attr('fill', 'currentColor')
      .attr('class', 'dark:text-slate-200');

    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Zoom support
    svg.call(d3.zoom<SVGSVGElement, unknown>().on('zoom', (event) => {
      g.attr('transform', event.transform);
    }));

  }, [results, subjectName]);

  return (
    <Card className="h-full">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Network className="h-4 w-4" /> Identity Relationship Graph
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden bg-slate-50 dark:bg-slate-900/50">
        <svg
          ref={svgRef}
          width="100%"
          height="400"
          className="cursor-move"
          viewBox="0 0 600 400"
          preserveAspectRatio="xMidYMid meet"
        />
      </CardContent>
    </Card>
  );
}
