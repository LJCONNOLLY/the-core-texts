import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { loadIndex } from '../utils/data';

export default function Library() {
  const [index, setIndex] = useState(null);
  const [filter, setFilter] = useState('');
  const [formatFilter, setFormatFilter] = useState('all');
  const [sortBy, setSortBy] = useState('title');

  useEffect(() => {
    loadIndex().then(setIndex);
  }, []);

  if (!index) return <div className="loading">Loading library...</div>;

  const formats = [...new Set(index.books.map(b => b.format))].sort();

  let books = index.books.filter(b => {
    const q = filter.toLowerCase();
    const matchesText = !q || b.title.toLowerCase().includes(q)
      || (b.author || []).join(' ').toLowerCase().includes(q);
    const matchesFormat = formatFilter === 'all' || b.format === formatFilter;
    return matchesText && matchesFormat;
  });

  books = [...books].sort((a, b) => {
    if (sortBy === 'title') return a.title.localeCompare(b.title);
    if (sortBy === 'year') return (b.year || 0) - (a.year || 0);
    if (sortBy === 'author') return ((a.author || [])[0] || '').localeCompare((b.author || [])[0] || '');
    return 0;
  });

  return (
    <div>
      <div className="page-header">
        <h1>The Library</h1>
        <p>{index.books.length} texts in the archive</p>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2.25rem', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ maxWidth: '450px', fontSize: '1.35rem', padding: '0.9rem 1.5rem' }}
          placeholder="Filter by title or author..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <select className="input" style={{ maxWidth: '210px', fontSize: '1.35rem', padding: '0.9rem 1.5rem' }} value={formatFilter} onChange={e => setFormatFilter(e.target.value)}>
          <option value="all">All formats</option>
          {formats.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
        </select>
        <select className="input" style={{ maxWidth: '210px', fontSize: '1.35rem', padding: '0.9rem 1.5rem' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="title">Sort: Title</option>
          <option value="year">Sort: Year</option>
          <option value="author">Sort: Author</option>
        </select>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '1.25rem',
      }}>
        {books.map(book => (
          <Link key={book.id} to={`/book/${book.id}`} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ height: '100%', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <h3 style={{
                  fontFamily: 'var(--font-heading)', fontSize: '32px', flex: 1, marginRight: '0.75rem', lineHeight: 1.35,
                  background: '#fce4ec', padding: '0.2rem 0.4rem', borderRadius: '4px', display: 'inline',
                  boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone',
                }}>
                  {book.title}
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, marginTop: '0.3rem' }}>
                  {book.format}
                </span>
              </div>
              <p style={{
                fontFamily: 'var(--font-heading)', fontSize: '26px', marginBottom: '0.5rem',
              }}>
                <span style={{ background: '#fff9c4', padding: '0.15rem 0.35rem', borderRadius: '3px' }}>
                  {(book.author || []).join(', ') || 'Unknown author'}
                </span>
              </p>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: '26px' }}>
                <span style={{ background: '#c8e6c9', padding: '0.15rem 0.35rem', borderRadius: '3px' }}>
                  {book.year || 'n.d.'}
                </span>
              </p>
            </div>
          </Link>
        ))}
      </div>

      {books.length === 0 && (
        <div className="empty-state">
          <p>No books match your filters.</p>
        </div>
      )}
    </div>
  );
}
