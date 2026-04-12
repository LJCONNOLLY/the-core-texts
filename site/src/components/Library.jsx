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
        gap: '1.5rem',
      }}>
        {books.map(book => (
          <Link key={book.id} to={`/book/${book.id}`} style={{ textDecoration: 'none' }}>
            <div className="card" style={{
              height: '100%', padding: 0, overflow: 'hidden',
              display: 'flex', flexDirection: 'row',
              background: '#b5c4a8', border: 'none', borderRadius: '10px',
              minHeight: '280px',
            }}>
              {/* Left half: metadata */}
              <div style={{
                flex: 1, padding: '1.75rem', display: 'flex', flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <h3 style={{
                  fontFamily: 'var(--font-heading)', fontSize: '28px', lineHeight: 1.3,
                  color: '#2d3a2d', marginBottom: '0.75rem',
                }}>
                  {book.title}
                </h3>
                <p style={{
                  fontFamily: 'var(--font-heading)', fontSize: '20px',
                  color: '#3d4d3d', fontWeight: 700, marginBottom: '0.5rem',
                }}>
                  {(book.author || []).join(', ') || 'Unknown author'}
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.25rem' }}>
                  <span style={{
                    fontFamily: 'var(--font-heading)', fontSize: '18px',
                    background: '#c17a5a', padding: '0.2rem 0.5rem', borderRadius: '4px',
                    color: '#fff',
                  }}>
                    {book.year || 'n.d.'}
                  </span>
                  <span style={{
                    fontSize: '13px', color: '#556b55', fontWeight: 500,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                  }}>
                    {book.format}
                  </span>
                </div>
              </div>
              {/* Right half: cover image */}
              <div style={{
                width: '45%', flexShrink: 0,
                borderLeft: '3px solid #b5c4a8',
                background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                <BookCover bookId={book.id} title={book.title} />
              </div>
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

function BookCover({ bookId, title }) {
  const [src, setSrc] = useState(null);
  const base = import.meta.env.BASE_URL;

  useEffect(() => {
    // Try jpg first, then png
    const img = new Image();
    img.onload = () => setSrc(img.src);
    img.onerror = () => {
      const img2 = new Image();
      img2.onload = () => setSrc(img2.src);
      img2.onerror = () => setSrc(null);
      img2.src = `${base}covers/${bookId}.png`;
    };
    img.src = `${base}covers/${bookId}.jpg`;
  }, [bookId, base]);

  if (src) {
    return (
      <img
        src={src}
        alt={`Cover of ${title}`}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#8a9a8a', fontSize: '14px',
      fontFamily: 'var(--font-heading)', fontStyle: 'italic', padding: '1rem',
      textAlign: 'center',
    }}>
      No cover
    </div>
  );
}
