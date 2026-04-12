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

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ maxWidth: '300px' }}
          placeholder="Filter by title or author..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
        <select className="input" style={{ maxWidth: '140px' }} value={formatFilter} onChange={e => setFormatFilter(e.target.value)}>
          <option value="all">All formats</option>
          {formats.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
        </select>
        <select className="input" style={{ maxWidth: '140px' }} value={sortBy} onChange={e => setSortBy(e.target.value)}>
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
            <div className="card" style={{ height: '100%', padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem', flex: 1, marginRight: '0.5rem', lineHeight: 1.3 }}>
                  {book.title}
                </h3>
                <span className={`format-badge ${book.format}`}>{book.format}</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: '0.35rem' }}>
                {(book.author || []).join(', ') || 'Unknown author'}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                {book.year || 'n.d.'}{book.publisher ? ` • ${book.publisher}` : ''}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                <span>{book.page_count} {book.format === 'epub' || book.format === 'mobi' || book.format === 'azw3' ? 'sections' : 'pages'}</span>
                <span>•</span>
                <span>{(book.word_count || 0).toLocaleString()} words</span>
                {(book.definitions?.text?.length > 0 || book.definitions?.technology?.length > 0) && (
                  <>
                    <span>•</span>
                    <span className="tag tag-gold">definitions</span>
                  </>
                )}
              </div>
              {book.frameworks && book.frameworks.length > 0 && (
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                  {book.frameworks.map(f => (
                    <span key={f} className="tag">{f}</span>
                  ))}
                </div>
              )}
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
