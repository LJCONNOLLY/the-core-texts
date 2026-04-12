import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { loadIndex, getApiKey } from '../utils/data';
import { generateFrameworkSummary } from '../utils/api';

const DEFAULT_FRAMEWORKS = [
  'feminist technoscience', 'critical race technology studies',
  'critical data studies', 'actor-network theory', 'design justice',
  'digital black feminism', 'postcolonial digital humanities',
  'social justice in technical communication', 'cultural analytics',
  'media archaeology'
];

export default function FrameworkTracker() {
  const [index, setIndex] = useState(null);
  const [selected, setSelected] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const [matchedBooks, setMatchedBooks] = useState([]);

  useEffect(() => {
    loadIndex().then(setIndex);
  }, []);

  useEffect(() => {
    if (!selected || !index) return;

    // Find books that might engage with this framework
    // Use heuristic: search book titles and definitions for framework terms
    const terms = selected.toLowerCase().split(/\s+/);
    const matched = index.books.filter(book => {
      const searchText = [
        book.title,
        ...(book.author || []),
        ...(book.definitions?.text?.map(d => d.excerpt) || []),
        ...(book.definitions?.technology?.map(d => d.excerpt) || []),
      ].join(' ').toLowerCase();

      return terms.some(t => t.length > 3 && searchText.includes(t));
    });

    setMatchedBooks(matched);
  }, [selected, index]);

  const handleGenerate = async () => {
    if (!getApiKey()) { setSummaryError('Set your API key in Settings first.'); return; }
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const passages = matchedBooks.flatMap(book => {
        const defs = [
          ...(book.definitions?.text || []),
          ...(book.definitions?.technology || []),
        ];
        return defs.slice(0, 3).map(d => ({
          book: book.title,
          author: (book.author || []).join(', '),
          excerpt: d.excerpt,
        }));
      });

      const result = await generateFrameworkSummary(
        selected,
        matchedBooks.map(b => b.title),
        passages
      );
      setSummary(result);
    } catch (e) {
      setSummaryError(e.message);
    }
    setSummaryLoading(false);
  };

  if (!index) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Framework Tracker</h1>
        <p>Theoretical frameworks across the reading list</p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ width: '260px', flexShrink: 0 }}>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Frameworks
          </h3>
          {DEFAULT_FRAMEWORKS.sort().map(fw => (
            <button
              key={fw}
              onClick={() => { setSelected(fw); setSummary(null); setSummaryError(''); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.6rem 0.75rem',
                border: 'none',
                background: selected === fw ? 'var(--white)' : 'transparent',
                color: selected === fw ? 'var(--navy)' : 'var(--text-secondary)',
                fontWeight: selected === fw ? 600 : 400,
                fontSize: '0.875rem',
                borderRadius: '4px',
                borderLeft: selected === fw ? '3px solid var(--gold)' : '3px solid transparent',
                cursor: 'pointer',
                marginBottom: '0.15rem',
                textTransform: 'capitalize',
              }}
            >
              {fw}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: '300px' }}>
          {selected ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', textTransform: 'capitalize' }}>{selected}</h2>
                <button className="btn btn-gold" onClick={handleGenerate} disabled={summaryLoading}>
                  {summaryLoading ? 'Generating...' : (summary ? 'Regenerate' : 'Generate Summary')}
                </button>
              </div>

              {summaryError && <p style={{ color: '#c0392b', fontSize: '0.85rem', marginBottom: '1rem' }}>{summaryError}</p>}

              {summary && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.7, marginBottom: '1rem' }}>{summary.summary}</p>
                  {summary.key_concepts?.length > 0 && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Key Concepts</h4>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {summary.key_concepts.map(c => <span key={c} className="tag tag-gold">{c}</span>)}
                      </div>
                    </div>
                  )}
                  {summary.key_scholars?.length > 0 && (
                    <div>
                      <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Key Scholars</h4>
                      <p style={{ fontSize: '0.85rem' }}>{summary.key_scholars.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}

              <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
                Related Books ({matchedBooks.length})
              </h3>
              {matchedBooks.map(book => (
                <Link key={book.id} to={`/book/${book.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div className="card" style={{ marginBottom: '0.75rem' }}>
                    <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem' }}>{book.title}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {(book.author || []).join(', ')} ({book.year || 'n.d.'})
                    </p>
                  </div>
                </Link>
              ))}

              {matchedBooks.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No books automatically matched. Generate a summary to explore this framework.
                </p>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>Select a framework from the list to explore how it appears across the reading list.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
