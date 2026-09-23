import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { loadIndex, loadTalking } from '../utils/data';
import { highlightText } from '../utils/text';

const FILTERS = [
  { id: 'all', label: 'Everywhere' },
  { id: 'body', label: 'In the text' },
  { id: 'notes', label: 'In the notes' },
];

export default function TalkingToEachOther() {
  const [index, setIndex] = useState(null);
  const [talking, setTalking] = useState(null);
  const [error, setError] = useState(null);
  const [sourceId, setSourceId] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    Promise.all([loadIndex(), loadTalking()])
      .then(([idx, t]) => {
        setIndex(idx);
        setTalking(t);
        setSourceId(Object.keys(t.sources)[0] || null);
      })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div className="empty-state"><p>Could not load cross-references: {error}</p></div>;
  if (!index || !talking) return <div className="loading">Loading...</div>;

  const bookLookup = {};
  for (const book of index.books) bookLookup[book.id] = book;

  const source = sourceId ? talking.sources[sourceId] : null;
  const mentions = source ? source.mentions.filter(m =>
    filter === 'all' || (filter === 'notes' ? m.in_notes : !m.in_notes)
  ) : [];

  // Group by cited author, most-mentioned first
  const groups = {};
  for (const m of mentions) {
    if (!groups[m.author]) groups[m.author] = { author: m.author, bookId: m.bookId, mentions: [] };
    groups[m.author].mentions.push(m);
  }
  const grouped = Object.values(groups).sort((a, b) =>
    b.mentions.length - a.mentions.length || a.author.localeCompare(b.author)
  );

  return (
    <div>
      <div className="page-header">
        <h1>Talking to Each Other</h1>
        <p>Every place a book names another author on the core list, with the sentence before and after.</p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ width: '300px', flexShrink: 0, maxHeight: '80vh', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Books
          </h3>
          {Object.entries(talking.sources).map(([id, src]) => (
            <button
              key={id}
              onClick={() => setSourceId(id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.6rem 0.75rem',
                border: 'none',
                background: sourceId === id ? 'var(--white)' : 'transparent',
                color: sourceId === id ? 'var(--forest)' : 'var(--text-secondary)',
                fontWeight: sourceId === id ? 700 : 400,
                fontFamily: 'var(--font-heading)',
                fontSize: '1.15rem',
                borderRadius: '4px',
                borderLeft: sourceId === id ? '3px solid var(--coral)' : '3px solid transparent',
                cursor: 'pointer',
                marginBottom: '0.25rem',
              }}
            >
              {bookLookup[id]?.title.replace(/\s*\(.*\)$/, '') || src.title}
              <span style={{
                display: 'block', fontSize: '0.85rem', fontWeight: 400,
                color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
                marginTop: '0.1rem',
              }}>
                {src.authors.join(' & ')} {'•'} {src.mentions.length} mentions
              </span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: '300px' }}>
          {source && (
            <div>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>
                Who {source.title.replace(/\s*\(.*\)$/, '')} talks to
              </h2>
              <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                {grouped.length} core author{grouped.length !== 1 ? 's' : ''} {'•'} {mentions.length} mention{mentions.length !== 1 ? 's' : ''}
              </p>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {FILTERS.map(f => (
                  <button
                    key={f.id}
                    className={`btn ${filter === f.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {grouped.map(group => {
                const book = bookLookup[group.bookId];
                return (
                  <div key={group.author} className="card" style={{ marginBottom: '1.25rem' }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem' }}>
                        {group.author}
                        <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                          {group.mentions.length} mention{group.mentions.length !== 1 ? 's' : ''}
                        </span>
                      </h3>
                      {book && (
                        <Link to={`/book/${book.id}`} style={{ fontSize: '1rem' }}>
                          {book.title}
                        </Link>
                      )}
                    </div>

                    <ol style={{ paddingLeft: '1.25rem' }}>
                      {group.mentions.map((m, i) => (
                        <li key={i} style={{ marginBottom: '1rem', paddingLeft: '0.25rem' }}>
                          <Link
                            to={`/book/${sourceId}?locator=${m.locator}`}
                            style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}
                          >
                            {m.in_notes
                              ? <><span className="tag tag-gold">In the notes</span> {[m.section, m.note && `note ${m.note}`].filter(Boolean).join(', ')}</>
                              : m.section}
                          </Link>
                          <p style={{ fontSize: '1rem', lineHeight: 1.7, color: 'var(--text-secondary)', borderLeft: '3px solid var(--coral)', paddingLeft: '1rem' }}>
                            {m.before && <span style={{ color: 'var(--text-muted)' }}>{m.before} </span>}
                            <span style={{ color: 'var(--text-primary)' }}>{highlightText(m.sentence, m.highlights)}</span>
                            {m.after && <span style={{ color: 'var(--text-muted)' }}> {m.after}</span>}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </div>
                );
              })}

              {grouped.length === 0 && (
                <div className="empty-state">
                  <p>{source.mentions.length
                    ? 'No mentions with this filter.'
                    : 'This book doesn’t name any other author on the core list.'}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
