import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { loadIndex } from '../utils/data';

export default function ConversationMap() {
  const svgRef = useRef(null);
  const [index, setIndex] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadIndex().then(setIndex);
  }, []);

  useEffect(() => {
    if (!index || !svgRef.current) return;

    const { nodes, links } = buildGraphData(index);
    renderGraph(svgRef.current, nodes, links, setSelectedNode);
  }, [index]);

  if (!index) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Conversation Map</h1>
        <p>Network of books, scholars, and shared frameworks</p>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '500px' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <svg ref={svgRef} style={{ width: '100%', height: '600px', display: 'block' }} />
          </div>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#c9a84c', marginRight: 4 }} />Book</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#2a3a5c', marginRight: 4 }} />Scholar</span>
            <span style={{ marginLeft: 'auto' }}>Drag to rearrange. Click for details.</span>
          </div>
        </div>

        {selectedNode && (
          <div style={{ width: '280px', flexShrink: 0 }}>
            <div className="card">
              <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{selectedNode.label}</h3>
              {selectedNode.type === 'book' ? (
                <>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {selectedNode.author} ({selectedNode.year || 'n.d.'})
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    {selectedNode.wordCount?.toLocaleString()} words
                  </p>
                  <button
                    className="btn btn-primary"
                    style={{ marginTop: '1rem', width: '100%' }}
                    onClick={() => navigate(`/book/${selectedNode.id}`)}
                  >
                    View Book
                  </button>
                </>
              ) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Cited scholar. {selectedNode.connections} connections.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function buildGraphData(index) {
  const nodes = [];
  const links = [];
  const authorMap = {};

  // Add book nodes
  index.books.forEach(book => {
    nodes.push({
      id: book.id,
      label: book.title,
      type: 'book',
      author: (book.author || []).join(', '),
      year: book.year,
      wordCount: book.word_count,
      radius: 8 + Math.min(12, Math.log(book.word_count || 1000) * 1.5),
    });

    // Track authors as potential scholar nodes
    (book.author || []).forEach(a => {
      const key = a.toLowerCase();
      if (!authorMap[key]) authorMap[key] = { name: a, books: [] };
      authorMap[key].books.push(book.id);
    });
  });

  // Add scholar nodes for authors with multiple works or notable scholars
  Object.entries(authorMap).forEach(([key, data]) => {
    if (data.books.length > 1) {
      const scholarId = `scholar-${key.replace(/\s+/g, '-')}`;
      nodes.push({
        id: scholarId,
        label: data.name,
        type: 'scholar',
        connections: data.books.length,
        radius: 6 + data.books.length * 3,
      });
      data.books.forEach(bookId => {
        links.push({ source: scholarId, target: bookId, type: 'authorship' });
      });
    }
  });

  // Create links between books that share similar themes (based on definition overlap)
  const bookIds = index.books.map(b => b.id);
  for (let i = 0; i < bookIds.length; i++) {
    for (let j = i + 1; j < bookIds.length; j++) {
      const a = index.books[i];
      const b = index.books[j];

      // Connect books that both have text or technology definitions
      const aHasDefs = (a.definitions?.text?.length || 0) + (a.definitions?.technology?.length || 0);
      const bHasDefs = (b.definitions?.text?.length || 0) + (b.definitions?.technology?.length || 0);

      if (aHasDefs > 0 && bHasDefs > 0) {
        links.push({ source: a.id, target: b.id, type: 'shared_theme' });
      }

      // Connect books from similar time periods and shared publishers
      if (a.year && b.year && Math.abs(a.year - b.year) <= 2 && a.publisher === b.publisher && a.publisher) {
        links.push({ source: a.id, target: b.id, type: 'same_publisher_era' });
      }
    }
  }

  return { nodes, links };
}

function renderGraph(svgEl, nodes, links, onSelect) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = svgEl.clientWidth || 800;
  const height = 600;

  const g = svg.append('g');

  // Zoom
  svg.call(d3.zoom().scaleExtent([0.3, 3]).on('zoom', (e) => {
    g.attr('transform', e.transform);
  }));

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(80))
    .force('charge', d3.forceManyBody().strength(-200))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius(d => d.radius + 5));

  const link = g.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', d => d.type === 'authorship' ? '#c9a84c' : '#d4cfc5')
    .attr('stroke-width', d => d.type === 'authorship' ? 1.5 : 0.8)
    .attr('stroke-dasharray', d => d.type === 'shared_theme' ? '4,3' : 'none')
    .attr('opacity', 0.6);

  const node = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', d => d.radius)
    .attr('fill', d => d.type === 'book' ? '#c9a84c' : '#2a3a5c')
    .attr('stroke', '#fff')
    .attr('stroke-width', 1.5)
    .attr('cursor', 'pointer')
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    )
    .on('click', (e, d) => onSelect(d))
    .on('mouseover', function (e, d) {
      d3.select(this).attr('stroke', '#c9a84c').attr('stroke-width', 3);
      // Highlight connected
      const connected = new Set();
      links.forEach(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        if (s === d.id) connected.add(t);
        if (t === d.id) connected.add(s);
      });
      node.attr('opacity', n => n.id === d.id || connected.has(n.id) ? 1 : 0.2);
      link.attr('opacity', l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return s === d.id || t === d.id ? 0.8 : 0.05;
      });
      label.attr('opacity', n => n.id === d.id || connected.has(n.id) ? 1 : 0.1);
    })
    .on('mouseout', function () {
      d3.select(this).attr('stroke', '#fff').attr('stroke-width', 1.5);
      node.attr('opacity', 1);
      link.attr('opacity', 0.6);
      label.attr('opacity', 1);
    });

  const label = g.append('g')
    .selectAll('text')
    .data(nodes)
    .join('text')
    .text(d => d.label.length > 25 ? d.label.slice(0, 25) + '...' : d.label)
    .attr('font-size', d => d.type === 'book' ? '8px' : '9px')
    .attr('font-weight', d => d.type === 'scholar' ? 600 : 400)
    .attr('font-family', 'Inter, sans-serif')
    .attr('fill', '#1a2744')
    .attr('text-anchor', 'middle')
    .attr('dy', d => d.radius + 12)
    .attr('pointer-events', 'none');

  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);

    label
      .attr('x', d => d.x)
      .attr('y', d => d.y);
  });
}
