import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as d3 from 'd3';
import { loadIndex } from '../utils/data';

// ─── Citation data ──────────────────────────────────────────────────────────
const CITATIONS = {
  'jackson-hashtagactivism-networks-of-race-and-gen': ['Nancy Fraser', 'danah boyd', 'Patricia Hill Collins', 'Kimberlé Crenshaw', 'Catherine Squires'],
  'noble-algorithms-of-oppression': ['Stuart Hall', 'bell hooks', 'Patricia Hill Collins'],
  'eubanks-automating-inequality-how-high-tech-tool': ['Ida B. Wells', 'W.E.B. Du Bois', 'Safiya Noble', 'Ruha Benjamin'],
  'losh-bodies-of-information': ['Donna Haraway', 'N. Katherine Hayles', 'Kimberlé Crenshaw', 'Johanna Drucker'],
  'vee-coding-literacy-how-computer-programming': ['Brian Street', 'Walter Ong', 'James Paul Gee', 'Ian Bogost'],
  'manovich-cultural-analytics': ['Franco Moretti', 'Walter Benjamin'],
  'dignazio-data-feminism-strong-ideas': ['Donna Haraway', 'Sandra Harding', 'Patricia Hill Collins', 'Kimberlé Crenshaw'],
  'gold-debates-in-the-digital-humanities-2023': ['Roopika Risam', 'Miriam Posner', 'Alan Liu'],
  'costanzachock-design-justice-community-led-practices-t': ['Patricia Hill Collins', 'Kimberlé Crenshaw', 'Aimi Hamraie'],
  'tham-design-thinking-in-technical-communicati': ['Herbert Simon', 'Tim Brown', 'Richard Buchanan', 'Carolyn Miller'],
  'gonzales-designing-multilingual-experiences-in-te': ['Suresh Canagarajah', 'Walton Moore and Jones'],
  'steele-digital-black-feminism-critical-cultural': ['Patricia Hill Collins', 'bell hooks', 'Moya Bailey', 'André Brock'],
  'nakamura-digitizing-race-visual-cultures-of-the-i': ['Michael Omi', 'Howard Winant', 'Stuart Hall'],
  'jr-distributed-blackness-african-american-c': ['W.E.B. Du Bois', 'Stuart Hall', 'Lisa Nakamura'],
  'hayles-how-we-became-posthuman-virtual-bodies-i': ['Norbert Wiener', 'Claude Shannon', 'Gregory Bateson', 'Donna Haraway'],
  'mckinney-information-activism-a-queer-history-of': ['Susan Leigh Star', 'Judy Wajcman'],
  'gray-intersectional-tech-black-users-in-digit': ['Kimberlé Crenshaw', 'Kishonna Gray', 'Anita Sarkeesian'],
  'bailey-misogynoir-transformed-black-womens-digi': ['Patricia Hill Collins', 'Kimberlé Crenshaw', 'Catherine Knight Steele', 'Moya Bailey'],
  'risam-new-digital-worlds-postcolonial-digital': ['Gayatri Spivak', 'Homi Bhabha', 'Walter Mignolo', 'Alan Liu', 'Miriam Posner'],
  'ong-orality-and-literacy-the-technologizing': ['Marshall McLuhan', 'Eric Havelock', 'Jack Goody'],
  'foucault-order-of-things-an-archaeology-of-human': ['Claude Lévi-Strauss', 'Ferdinand de Saussure', 'Georges Canguilhem'],
  'benjamin-race-after-technology': ['Michelle Alexander', 'Safiya Noble', 'Virginia Eubanks', 'Langdon Winner', 'Sheila Jasanoff'],
  'latour-reassembling-the-social-an-introduction': ['Émile Durkheim', 'Michel Callon', 'John Law'],
  'haraway-simians-cyborgs-and-women-the-reinventio': ['Sandra Harding', 'Donna Haraway'],
  'walton-technical-communication-after-the-social': ['Kimberlé Crenshaw', 'Patricia Hill Collins', 'Carolyn Miller'],
  'drucker-the-digital-humanities-coursebook-an-int': ['Jerome McGann', 'Alan Liu', 'Franco Moretti'],
  'chun-updating-to-remain-the-same-habitual-new': ['William James', 'Felix Ravaisson', 'Benedict Anderson', 'Michel Foucault'],
  'rose-visual-methodologies-an-introduction-to': ['Roland Barthes', 'Michel Foucault', 'Laura Mulvey', 'Stuart Hall'],
  'ahmed-whats-the-use-on-the-uses-of-use': ['Martin Heidegger', 'Maurice Merleau-Ponty', 'Sara Ahmed'],
  'mullaney-your-computer-is-on-fire': ['Ruha Benjamin', 'Safiya Noble', 'Virginia Eubanks', 'Donna Haraway'],
};

const SCHOLAR_TO_BOOK = {
  'safiya noble': 'noble-algorithms-of-oppression',
  'ruha benjamin': 'benjamin-race-after-technology',
  'virginia eubanks': 'eubanks-automating-inequality-how-high-tech-tool',
  'donna haraway': 'haraway-simians-cyborgs-and-women-the-reinventio',
  'n. katherine hayles': 'hayles-how-we-became-posthuman-virtual-bodies-i',
  'moya bailey': 'bailey-misogynoir-transformed-black-womens-digi',
  'andré brock': 'jr-distributed-blackness-african-american-c',
  'lisa nakamura': 'nakamura-digitizing-race-visual-cultures-of-the-i',
  'walter ong': 'ong-orality-and-literacy-the-technologizing',
  'michel foucault': 'foucault-order-of-things-an-archaeology-of-human',
  'johanna drucker': 'drucker-the-digital-humanities-coursebook-an-int',
  'roopika risam': 'risam-new-digital-worlds-postcolonial-digital',
  'sara ahmed': 'ahmed-whats-the-use-on-the-uses-of-use',
  'kishonna gray': 'gray-intersectional-tech-black-users-in-digit',
  'catherine knight steele': 'steele-digital-black-feminism-critical-cultural',
};

const CLUSTERS = {
  'Black Digital Studies': ['jr-distributed-blackness-african-american-c', 'steele-digital-black-feminism-critical-cultural', 'bailey-misogynoir-transformed-black-womens-digi', 'noble-algorithms-of-oppression', 'nakamura-digitizing-race-visual-cultures-of-the-i', 'gray-intersectional-tech-black-users-in-digit', 'jackson-hashtagactivism-networks-of-race-and-gen'],
  'Feminist STS': ['haraway-simians-cyborgs-and-women-the-reinventio', 'hayles-how-we-became-posthuman-virtual-bodies-i', 'dignazio-data-feminism-strong-ideas', 'losh-bodies-of-information', 'mckinney-information-activism-a-queer-history-of'],
  'TPC & Rhetoric': ['walton-technical-communication-after-the-social', 'gonzales-designing-multilingual-experiences-in-te', 'tham-design-thinking-in-technical-communicati', 'vee-coding-literacy-how-computer-programming'],
  'DH Methods': ['manovich-cultural-analytics', 'drucker-the-digital-humanities-coursebook-an-int', 'risam-new-digital-worlds-postcolonial-digital', 'gold-debates-in-the-digital-humanities-2023'],
  'Critical Data Studies': ['benjamin-race-after-technology', 'eubanks-automating-inequality-how-high-tech-tool', 'chun-updating-to-remain-the-same-habitual-new', 'latour-reassembling-the-social-an-introduction', 'foucault-order-of-things-an-archaeology-of-human'],
};

const CLUSTER_COLORS = {
  'Black Digital Studies': '#8B4513',
  'Feminist STS': '#6B3FA0',
  'TPC & Rhetoric': '#2E86AB',
  'DH Methods': '#A23B72',
  'Critical Data Studies': '#E76F51',
};

const NODE_COLORS = { book: '#e6c833', scholarIn: '#4a8c5c', scholarOut: '#8B6914' };

function getNodeColor(d) {
  if (d.type === 'book' && d.isAlsoCitedScholar) return NODE_COLORS.scholarIn;
  if (d.type === 'book') return NODE_COLORS.book;
  return NODE_COLORS.scholarOut;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ConversationMap() {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [index, setIndex] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [cardPos, setCardPos] = useState({ x: 0, y: 0 });
  const [nodeFilter, setNodeFilter] = useState('all');
  const [clusterFilter, setClusterFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const simulationRef = useRef(null);
  const zoomRef = useRef(null);

  useEffect(() => { loadIndex().then(setIndex); }, []);

  useEffect(() => {
    if (!index) return;
    const data = buildGraphData(index);
    setGraphData(data);
  }, [index]);

  useEffect(() => {
    if (!graphData || !svgRef.current) return;
    const cleanup = renderGraph(svgRef.current, graphData, {
      onSelect: (d, pos) => { setSelectedNode(d); setCardPos(pos); },
      nodeFilter, clusterFilter, searchQuery,
      simulationRef, zoomRef,
    });
    return cleanup;
  }, [graphData, nodeFilter, clusterFilter]);

  // Search
  useEffect(() => {
    if (!graphData || !searchQuery.trim()) { setSearchResults([]); return; }
    const q = searchQuery.toLowerCase();
    const matches = graphData.nodes.filter(n => n.label.toLowerCase().includes(q));
    setSearchResults(matches.slice(0, 8));

    if (matches.length > 0 && svgRef.current && zoomRef.current) {
      const best = matches[0];
      if (best.x != null && best.y != null) {
        const svg = d3.select(svgRef.current);
        const width = svgRef.current.clientWidth;
        const height = 1000;
        const t = d3.zoomIdentity.translate(width / 2 - best.x, height / 2 - best.y);
        svg.transition().duration(500).call(zoomRef.current.transform, t);
      }
      // Highlight matching nodes
      d3.select(svgRef.current).selectAll('circle')
        .attr('stroke', d => matches.some(m => m.id === d.id) ? '#e6c833' : '#fff')
        .attr('stroke-width', d => matches.some(m => m.id === d.id) ? 4 : 2);
    }
  }, [searchQuery, graphData]);

  const handleSearchSelect = (node) => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedNode(node);
    if (node.x != null && svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current);
      const width = svgRef.current.clientWidth;
      const t = d3.zoomIdentity.translate(width / 2 - node.x, 500 - node.y);
      svg.transition().duration(500).call(zoomRef.current.transform, t);
    }
  };

  const resetFilters = () => {
    setNodeFilter('all');
    setClusterFilter(null);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedNode(null);
    if (svgRef.current && zoomRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
      d3.select(svgRef.current).selectAll('circle').attr('stroke', '#fff').attr('stroke-width', 2);
    }
  };

  // Apply filters via D3 opacity
  useEffect(() => {
    if (!svgRef.current || !graphData) return;
    const svg = d3.select(svgRef.current);

    const clusterBookIds = clusterFilter ? new Set(CLUSTERS[clusterFilter] || []) : null;

    svg.selectAll('circle').style('opacity', d => {
      if (nodeFilter === 'books' && d.type !== 'book') return 0.1;
      if (nodeFilter === 'scholars' && d.type === 'book') return 0.1;
      if (clusterBookIds && d.type === 'book' && !clusterBookIds.has(d.id)) return 0.1;
      if (clusterBookIds && d.type !== 'book') return 0.15;
      return 1;
    });

    svg.selectAll('text').style('opacity', d => {
      if (nodeFilter === 'books' && d.type !== 'book') return 0.05;
      if (nodeFilter === 'scholars' && d.type === 'book') return 0.05;
      if (clusterBookIds && d.type === 'book' && !clusterBookIds.has(d.id)) return 0.05;
      if (clusterBookIds && d.type !== 'book') return 0.08;
      return 1;
    });

    svg.selectAll('line').style('opacity', 0.4);
  }, [nodeFilter, clusterFilter, graphData]);

  if (!index) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Conversation Map</h1>
        <p>Who is in conversation with whom across the reading list</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {['all', 'books', 'scholars'].map(f => (
            <button key={f} className={`btn ${nodeFilter === f ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.9rem', padding: '0.4rem 0.75rem' }}
              onClick={() => setNodeFilter(f)}>
              {f === 'all' ? 'Show All' : f === 'books' ? 'Books Only' : 'Scholars Only'}
            </button>
          ))}
        </div>
        <span style={{ color: 'var(--text-muted)', margin: '0 0.25rem' }}>|</span>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {Object.keys(CLUSTERS).map(c => (
            <button key={c} className={`btn ${clusterFilter === c ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.85rem', padding: '0.35rem 0.6rem' }}
              onClick={() => setClusterFilter(clusterFilter === c ? null : c)}>
              {c}
            </button>
          ))}
        </div>
        <button className="btn btn-secondary" style={{ fontSize: '0.85rem', padding: '0.35rem 0.6rem', marginLeft: '0.5rem' }}
          onClick={resetFilters}>Reset</button>

        {/* Search */}
        <div style={{ position: 'relative', marginLeft: 'auto' }}>
          <input className="input" style={{ width: '220px', fontSize: '0.9rem', padding: '0.4rem 0.75rem' }}
            placeholder="Search nodes..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          {searchResults.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
              {searchResults.map(n => (
                <button key={n.id} onClick={() => handleSearchSelect(n)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.9rem', borderBottom: '1px solid var(--border)' }}>
                  {n.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Map */}
      <div ref={containerRef} style={{ position: 'relative' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <svg ref={svgRef} style={{ width: '100%', height: '1000px', display: 'block' }} />
        </div>

        {/* Click card overlay */}
        {selectedNode && (
          <div style={{
            position: 'absolute',
            left: Math.min(cardPos.x + 20, (containerRef.current?.clientWidth || 800) - 340),
            top: Math.max(10, Math.min(cardPos.y - 60, 800)),
            width: '300px', background: '#fff', borderRadius: '10px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.2)', padding: '1.25rem', zIndex: 40,
            border: '1px solid var(--border)',
          }}>
            <button onClick={() => setSelectedNode(null)} style={{
              position: 'absolute', top: '8px', right: '10px', background: 'none', border: 'none',
              fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-muted)',
            }}>&times;</button>

            {selectedNode.type === 'book' ? (
              <>
                <img
                  src={`${import.meta.env.BASE_URL}covers/${selectedNode.id}.jpg`}
                  alt=""
                  style={{ width: '100%', height: '120px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.75rem' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '0.35rem' }}>
                  {selectedNode.label}
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  {selectedNode.author} ({selectedNode.year || 'n.d.'})
                </p>
                <Link to={`/book/${selectedNode.id}`} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Go to Book Profile
                </Link>
              </>
            ) : (
              <>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>
                  {selectedNode.label}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Cited by {selectedNode.citedByCount} book{selectedNode.citedByCount !== 1 ? 's' : ''}
                </p>
                <div>
                  {selectedNode.citedBy?.map(b => (
                    <Link key={b.id} to={`/book/${b.id}`} style={{
                      display: 'block', fontSize: '0.9rem', marginBottom: '0.35rem',
                      color: '#2d5a2d', textDecoration: 'underline',
                    }}>
                      {b.title}
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', fontSize: '1rem', color: 'var(--text-muted)', flexWrap: 'wrap', alignItems: 'center' }}>
        <span><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: NODE_COLORS.book, marginRight: 6, verticalAlign: 'middle' }} />Book in corpus</span>
        <span><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: NODE_COLORS.scholarIn, marginRight: 6, verticalAlign: 'middle' }} />Scholar in collection</span>
        <span><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: NODE_COLORS.scholarOut, marginRight: 6, verticalAlign: 'middle' }} />Scholar outside collection</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          Size =
          <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: '#999', verticalAlign: 'middle' }} /> 1x
          <span style={{ display: 'inline-block', width: 18, height: 18, borderRadius: '50%', background: '#999', verticalAlign: 'middle' }} /> 3-4x
          <span style={{ display: 'inline-block', width: 26, height: 26, borderRadius: '50%', background: '#999', verticalAlign: 'middle' }} /> 5+
        </span>
      </div>
    </div>
  );
}

// ─── Graph data builder ─────────────────────────────────────────────────────

function buildGraphData(index) {
  const nodes = [];
  const links = [];
  const scholarCounts = {};
  const bookMap = {};

  index.books.forEach(b => { bookMap[b.id] = b; });

  for (const [bookId, scholars] of Object.entries(CITATIONS)) {
    const book = bookMap[bookId];
    if (!book) continue;
    for (const scholar of scholars) {
      const key = scholar.toLowerCase();
      if (!scholarCounts[key]) scholarCounts[key] = { name: scholar, count: 0, citedBy: [] };
      scholarCounts[key].count++;
      scholarCounts[key].citedBy.push({ id: bookId, title: book.title });
    }
  }

  for (const [bookId, scholars] of Object.entries(CITATIONS)) {
    const book = bookMap[bookId];
    if (!book) continue;
    let citedCount = 0;
    let isAlsoCitedScholar = false;
    for (const author of (book.author || [])) {
      const key = author.toLowerCase();
      if (scholarCounts[key]) { citedCount = Math.max(citedCount, scholarCounts[key].count); isAlsoCitedScholar = true; }
    }
    nodes.push({
      id: bookId, label: book.title, type: 'book', isAlsoCitedScholar,
      author: (book.author || []).join(', '), year: book.year,
      citedScholars: scholars, citedByCount: citedCount,
      radius: Math.max(24, 24 + citedCount * 3),
    });
  }

  const bookNodeIds = new Set(nodes.map(n => n.id));

  for (const [key, data] of Object.entries(scholarCounts)) {
    const scholarBookId = SCHOLAR_TO_BOOK[key];
    if (scholarBookId && bookNodeIds.has(scholarBookId)) {
      for (const citing of data.citedBy) {
        if (citing.id !== scholarBookId) links.push({ source: citing.id, target: scholarBookId, type: 'cites_author' });
      }
      continue;
    }
    const scholarId = `scholar-${key.replace(/[^a-z0-9]/g, '-')}`;
    nodes.push({
      id: scholarId, label: data.name, type: 'scholar',
      citedByCount: data.count, citedBy: data.citedBy,
      bookId: scholarBookId || null,
      radius: Math.max(16, 12 + data.count * 4),
    });
    for (const citing of data.citedBy) links.push({ source: citing.id, target: scholarId, type: 'cites' });
  }

  return { nodes, links };
}

// ─── D3 Renderer ────────────────────────────────────────────────────────────

function renderGraph(svgEl, { nodes, links }, opts) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = svgEl.clientWidth || 1000;
  const height = 1000;
  const g = svg.append('g');

  const zoom = d3.zoom().scaleExtent([0.2, 4]).on('zoom', (e) => g.attr('transform', e.transform));
  svg.call(zoom);
  opts.zoomRef.current = zoom;

  // Tooltip
  const tooltip = d3.select('body').selectAll('.graph-tooltip').data([0]).join('div')
    .attr('class', 'graph-tooltip')
    .style('position', 'fixed').style('pointer-events', 'none')
    .style('background', '#2d3a2d').style('color', '#f0ebe2')
    .style('padding', '8px 14px').style('border-radius', '6px')
    .style('font-size', '14px').style('font-family', 'Inter, sans-serif')
    .style('max-width', '300px').style('opacity', 0).style('z-index', 9999);

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(70))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius(d => d.radius + 85))
    .force('x', d3.forceX(width / 2).strength(0.05))
    .force('y', d3.forceY(height / 2).strength(0.05));
  opts.simulationRef.current = simulation;

  // Cluster regions (drawn behind everything)
  const clusterGroup = g.append('g').attr('class', 'clusters');

  const link = g.append('g').selectAll('line').data(links).join('line')
    .attr('stroke', d => d.type === 'cites_author' ? '#c9a84c' : '#9aad8a')
    .attr('stroke-width', d => d.type === 'cites_author' ? 2 : 1.2)
    .style('opacity', 0.4).style('transition', 'opacity 200ms');

  const node = g.append('g').selectAll('circle').data(nodes).join('circle')
    .attr('r', d => d.radius)
    .attr('fill', getNodeColor)
    .attr('stroke', '#fff').attr('stroke-width', 2)
    .attr('cursor', 'pointer')
    .style('transition', 'opacity 200ms')
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    )
    .on('click', function (e, d) {
      const rect = svgEl.getBoundingClientRect();
      opts.onSelect(d, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    })
    .on('mouseover', function (e, d) {
      d3.select(this).attr('stroke', '#e6c833').attr('stroke-width', 4);
      tooltip.style('opacity', 1)
        .html(d.type === 'book'
          ? `<strong>${d.label}</strong><br/>${d.author}<br/>${d.year || ''}`
          : `<strong>${d.label}</strong><br/>Cited by ${d.citedByCount} book${d.citedByCount !== 1 ? 's' : ''}`)
        .style('left', (e.clientX + 15) + 'px').style('top', (e.clientY - 10) + 'px');

      const connected = new Set();
      links.forEach(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        if (s === d.id) connected.add(t);
        if (t === d.id) connected.add(s);
      });
      node.style('opacity', n => n.id === d.id || connected.has(n.id) ? 1 : 0.15);
      link.style('opacity', l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return s === d.id || t === d.id ? 0.8 : 0.03;
      });
      label.style('opacity', n => n.id === d.id || connected.has(n.id) ? 1 : 0.05);
    })
    .on('mousemove', (e) => tooltip.style('left', (e.clientX + 15) + 'px').style('top', (e.clientY - 10) + 'px'))
    .on('mouseout', function () {
      d3.select(this).attr('stroke', '#fff').attr('stroke-width', 2);
      tooltip.style('opacity', 0);
      node.style('opacity', 1);
      link.style('opacity', 0.4);
      label.style('opacity', 1);
    });

  const label = g.append('g').selectAll('text').data(nodes).join('text')
    .text(d => d.label.length > 22 ? d.label.slice(0, 22) + '...' : d.label)
    .attr('font-size', '24px').attr('font-weight', 700)
    .attr('font-family', 'Inter, sans-serif')
    .attr('fill', d => {
      const c = getNodeColor(d);
      // Darken the color for text
      if (c === NODE_COLORS.book) return '#b5a010';
      if (c === NODE_COLORS.scholarIn) return '#3a7a4a';
      return '#6b4e10';
    })
    .attr('text-anchor', 'middle')
    .attr('dy', d => d.radius + 20)
    .attr('pointer-events', 'none')
    .style('transition', 'opacity 200ms');

  // Draw cluster regions after simulation settles
  let tickCount = 0;
  simulation.on('tick', () => {
    tickCount++;
    link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
    node.attr('cx', d => d.x).attr('cy', d => d.y);
    label.attr('x', d => d.x).attr('y', d => d.y);

    if (tickCount === 200) drawClusterRegions(clusterGroup, nodes);
  });

  return () => { simulation.stop(); tooltip.style('opacity', 0); };
}

function drawClusterRegions(g, nodes) {
  g.selectAll('*').remove();

  for (const [name, memberIds] of Object.entries(CLUSTERS)) {
    const memberNodes = nodes.filter(n => memberIds.includes(n.id));
    if (memberNodes.length < 2) continue;

    const padding = 60;
    const xs = memberNodes.map(n => n.x);
    const ys = memberNodes.map(n => n.y);
    const x1 = Math.min(...xs) - padding;
    const y1 = Math.min(...ys) - padding;
    const x2 = Math.max(...xs) + padding;
    const y2 = Math.max(...ys) + padding;

    const color = CLUSTER_COLORS[name] || '#888';

    g.append('rect')
      .attr('x', x1).attr('y', y1)
      .attr('width', x2 - x1).attr('height', y2 - y1)
      .attr('rx', 20).attr('ry', 20)
      .attr('fill', color).attr('opacity', 0.06)
      .attr('stroke', color).attr('stroke-width', 1).attr('stroke-opacity', 0.15);

    g.append('text')
      .attr('x', x1 + 12).attr('y', y1 + 22)
      .text(name)
      .attr('font-size', '16px').attr('font-weight', 600)
      .attr('font-family', 'Inter, sans-serif')
      .attr('fill', color).attr('opacity', 0.4);
  }
}
