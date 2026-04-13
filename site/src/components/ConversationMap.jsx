import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as d3 from 'd3';
import { loadIndex } from '../utils/data';

// ─── Citation data: book → scholars in conversation with ───────────────────
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

// Map scholar names to book IDs (scholars who are also authors in the corpus)
const SCHOLAR_TO_BOOK = {
  'safiya noble': 'noble-algorithms-of-oppression',
  'ruha benjamin': 'benjamin-race-after-technology',
  'virginia eubanks': 'eubanks-automating-inequality-how-high-tech-tool',
  'donna haraway': 'haraway-simians-cyborgs-and-women-the-reinventio',
  'patricia hill collins': null, // not an author in corpus, but heavily cited
  'kimberlé crenshaw': null,
  'stuart hall': null,
  'w.e.b. du bois': null,
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
  'carolyn miller': null,
  'alan liu': null,
  'miriam posner': null,
  'sandra harding': null,
  'bell hooks': null,
  'franco moretti': null,
};

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
        <p>Who is in conversation with whom across the reading list</p>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '500px' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <svg ref={svgRef} style={{ width: '100%', height: '1000px', display: 'block' }} />
          </div>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem', fontSize: '1rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
            <span><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: '#e6c833', marginRight: 6, verticalAlign: 'middle' }} />Book in corpus</span>
            <span><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: '#4a8c5c', marginRight: 6, verticalAlign: 'middle' }} />Scholar in collection</span>
            <span><span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: '50%', background: '#c0392b', marginRight: 6, verticalAlign: 'middle' }} />Scholar outside collection</span>
            <span style={{ marginLeft: 'auto' }}>Drag nodes. Scroll to zoom. Click for details.</span>
          </div>
        </div>

        {selectedNode && (
          <div style={{ width: '320px', flexShrink: 0 }}>
            <div className="card">
              <h3 style={{ fontSize: '1.3rem', fontFamily: 'var(--font-heading)', marginBottom: '0.75rem' }}>
                {selectedNode.label}
              </h3>
              {selectedNode.type === 'book' ? (
                <>
                  <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    {selectedNode.author}
                  </p>
                  <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    {selectedNode.year || 'n.d.'}
                  </p>
                  {selectedNode.citedScholars && selectedNode.citedScholars.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <h4 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>In conversation with:</h4>
                      <ul style={{ listStyle: 'none', padding: 0 }}>
                        {selectedNode.citedScholars.map(s => (
                          <li key={s} style={{ fontSize: '1rem', marginBottom: '0.25rem', paddingLeft: '0.75rem', borderLeft: '2px solid var(--border)' }}>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                    onClick={() => navigate(`/book/${selectedNode.id}`)}
                  >
                    View Book
                  </button>
                </>
              ) : (
                <>
                  <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                    Cited by {selectedNode.citedByCount} book{selectedNode.citedByCount !== 1 ? 's' : ''} in the corpus
                  </p>
                  <h4 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Cited in:</h4>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {selectedNode.citedBy?.map(b => (
                      <li key={b.id} style={{ marginBottom: '0.5rem' }}>
                        <button
                          onClick={() => navigate(`/book/${b.id}`)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2d5a2d', textDecoration: 'underline', fontSize: '1rem', textAlign: 'left', padding: 0 }}
                        >
                          {b.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {selectedNode.bookId && (
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginTop: '0.75rem' }}
                      onClick={() => navigate(`/book/${selectedNode.bookId}`)}
                    >
                      View Their Book
                    </button>
                  )}
                </>
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
  const scholarCounts = {}; // scholar name -> { count, citedBy: [{id, title}] }
  const bookMap = {}; // book id -> book data

  // Index books
  index.books.forEach(b => { bookMap[b.id] = b; });

  // Count scholar citations
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

  // Add book nodes
  for (const [bookId, scholars] of Object.entries(CITATIONS)) {
    const book = bookMap[bookId];
    if (!book) continue;

    // Check if this book's author is cited by others
    let citedCount = 0;
    for (const author of (book.author || [])) {
      const key = author.toLowerCase();
      if (scholarCounts[key]) citedCount = Math.max(citedCount, scholarCounts[key].count);
    }

    nodes.push({
      id: bookId,
      label: book.title,
      type: 'book',
      author: (book.author || []).join(', '),
      year: book.year,
      citedScholars: scholars,
      radius: Math.max(24, 24 + citedCount * 3),
    });
  }

  // Add scholar nodes (only scholars not already represented as book authors, OR those who are)
  const bookNodeIds = new Set(nodes.map(n => n.id));

  for (const [key, data] of Object.entries(scholarCounts)) {
    const scholarBookId = SCHOLAR_TO_BOOK[key];

    // If this scholar IS an author of a book in the corpus, don't add a separate node
    // (the book node represents them)
    if (scholarBookId && bookNodeIds.has(scholarBookId)) {
      // Add links from citing books to the book node instead
      for (const citing of data.citedBy) {
        if (citing.id !== scholarBookId) {
          links.push({ source: citing.id, target: scholarBookId, type: 'cites_author' });
        }
      }
      continue;
    }

    const scholarId = `scholar-${key.replace(/[^a-z0-9]/g, '-')}`;
    const isHub = data.count >= 4;

    nodes.push({
      id: scholarId,
      label: data.name,
      type: 'scholar',
      isHub,
      citedByCount: data.count,
      citedBy: data.citedBy,
      bookId: scholarBookId || null,
      radius: Math.max(16, 12 + data.count * 4),
    });

    // Add links from books to this scholar
    for (const citing of data.citedBy) {
      links.push({ source: citing.id, target: scholarId, type: 'cites' });
    }
  }

  return { nodes, links };
}

function renderGraph(svgEl, nodes, links, onSelect) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  const width = svgEl.clientWidth || 1000;
  const height = 1000;

  const g = svg.append('g');

  // Zoom
  svg.call(d3.zoom().scaleExtent([0.2, 4]).on('zoom', (e) => {
    g.attr('transform', e.transform);
  }));

  // Tooltip
  const tooltip = d3.select('body').selectAll('.graph-tooltip').data([0]).join('div')
    .attr('class', 'graph-tooltip')
    .style('position', 'fixed')
    .style('pointer-events', 'none')
    .style('background', '#2d3a2d')
    .style('color', '#f0ebe2')
    .style('padding', '8px 12px')
    .style('border-radius', '6px')
    .style('font-size', '14px')
    .style('font-family', 'Inter, sans-serif')
    .style('max-width', '300px')
    .style('opacity', 0)
    .style('z-index', 9999);

  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(70))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collide', d3.forceCollide().radius(d => d.radius + 85))
    .force('x', d3.forceX(width / 2).strength(0.05))
    .force('y', d3.forceY(height / 2).strength(0.05));

  const link = g.append('g')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('stroke', d => d.type === 'cites_author' ? '#c9a84c' : '#9aad8a')
    .attr('stroke-width', d => d.type === 'cites_author' ? 2 : 1.2)
    .attr('opacity', 0.5);

  const node = g.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('r', d => d.radius)
    .attr('fill', d => {
      if (d.type === 'book') return '#e6c833';
      if (d.bookId) return '#4a8c5c';  // scholar in collection
      return '#c0392b';  // scholar outside collection
    })
    .attr('stroke', '#fff')
    .attr('stroke-width', 2)
    .attr('cursor', 'pointer')
    .call(d3.drag()
      .on('start', (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on('end', (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
    )
    .on('click', (e, d) => onSelect(d))
    .on('mouseover', function (e, d) {
      d3.select(this).attr('stroke', '#c17a5a').attr('stroke-width', 3);

      tooltip.style('opacity', 1)
        .html(d.type === 'book'
          ? `<strong>${d.label}</strong><br/>${d.author}<br/>${d.year || ''}`
          : `<strong>${d.label}</strong><br/>Cited by ${d.citedByCount} book${d.citedByCount !== 1 ? 's' : ''}`)
        .style('left', (e.clientX + 15) + 'px')
        .style('top', (e.clientY - 10) + 'px');

      // Highlight connected
      const connected = new Set();
      links.forEach(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        if (s === d.id) connected.add(t);
        if (t === d.id) connected.add(s);
      });
      node.attr('opacity', n => n.id === d.id || connected.has(n.id) ? 1 : 0.15);
      link.attr('opacity', l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return s === d.id || t === d.id ? 0.8 : 0.03;
      });
      label.attr('opacity', n => n.id === d.id || connected.has(n.id) ? 1 : 0.05);
    })
    .on('mousemove', function (e) {
      tooltip.style('left', (e.clientX + 15) + 'px').style('top', (e.clientY - 10) + 'px');
    })
    .on('mouseout', function () {
      d3.select(this).attr('stroke', '#fff').attr('stroke-width', 2);
      tooltip.style('opacity', 0);
      node.attr('opacity', 1);
      link.attr('opacity', 0.5);
      label.attr('opacity', 1);
    });

  const label = g.append('g')
    .selectAll('text')
    .data(nodes)
    .join('text')
    .text(d => {
      const maxLen = d.type === 'book' ? 22 : 20;
      return d.label.length > maxLen ? d.label.slice(0, maxLen) + '...' : d.label;
    })
    .attr('font-size', d => d.type === 'book' ? '24px' : '22px')
    .attr('font-weight', 700)
    .attr('font-family', 'Inter, sans-serif')
    .attr('fill', d => {
      if (d.type === 'book') return '#b5a010';
      if (d.bookId) return '#3a7a4a';
      return '#a02020';
    })
    .attr('text-anchor', 'middle')
    .attr('dy', d => d.radius + 20)
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
