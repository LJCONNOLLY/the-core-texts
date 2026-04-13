import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { loadIndex } from '../utils/data';

export default function Glossary() {
  const [index, setIndex] = useState(null);
  const [glossary, setGlossary] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [bookPassages, setBookPassages] = useState([]);

  useEffect(() => {
    loadIndex().then(setIndex);
    // Load glossary.json
    fetch(import.meta.env.BASE_URL + 'glossary.json')
      .then(r => r.ok ? r.json() : fetch(import.meta.env.BASE_URL + '../glossary.json').then(r2 => r2.json()))
      .then(data => setGlossary(data.terms || []))
      .catch(() => setGlossary([]));
  }, []);

  const selectedTerm = glossary.find(t => t.id === selectedId);

  useEffect(() => {
    if (!selectedTerm || !index) return;
    const termText = selectedTerm.term.toLowerCase().replace(/\s*\/\s*.*/,'');
    const passages = [];
    for (const book of index.books) {
      // Search all definition keys (text, technology, health, race, etc.)
      for (const [key, defs] of Object.entries(book.definitions || {})) {
        for (const def of defs) {
          if (def.excerpt.toLowerCase().includes(termText)) {
            passages.push({
              book: book.title,
              bookId: book.id,
              author: (book.author || []).join(', '),
              locator: def.locator,
              locatorType: def.locator_type,
              excerpt: def.excerpt,
              matchedTerm: key,
            });
          }
        }
      }
    }
    // Deduplicate by excerpt
    const seen = new Set();
    const unique = passages.filter(p => {
      const k = p.excerpt.slice(0, 100);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    setBookPassages(unique);
  }, [selectedId, index, selectedTerm]);

  if (!index) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Concept Glossary</h1>
        <p>{glossary.length} key theoretical terms</p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ width: '260px', flexShrink: 0 }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Terms
          </h3>
          {glossary.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.5rem 0.75rem',
                border: 'none',
                background: selectedId === t.id ? 'var(--white)' : 'transparent',
                color: selectedId === t.id ? 'var(--forest, var(--text-primary))' : 'var(--text-secondary)',
                fontWeight: selectedId === t.id ? 600 : 400,
                fontFamily: 'var(--font-heading)',
                fontSize: '1.1rem',
                borderRadius: '4px',
                borderLeft: selectedId === t.id ? '3px solid var(--coral, #c17a5a)' : '3px solid transparent',
                cursor: 'pointer',
                marginBottom: '0.15rem',
              }}
            >
              {t.term}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: '300px' }}>
          {selectedTerm ? (
            <div>
              <h2 style={{ fontSize: '2rem', marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>
                {selectedTerm.term}
              </h2>

              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '1.1rem', lineHeight: 1.8 }}>{selectedTerm.definition}</p>
              </div>

              {bookPassages.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
                    Found in {bookPassages.length} passage{bookPassages.length !== 1 ? 's' : ''} across the corpus
                  </h3>
                  {bookPassages.map((p, i) => (
                    <div key={i} className="card" style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <Link to={`/book/${p.bookId}`} style={{ fontWeight: 600, fontSize: '1rem' }}>
                            {p.book}
                          </Link>
                          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{p.author}</p>
                        </div>
                        <span className="tag">{p.locatorType} {p.locator}</span>
                      </div>
                      <p style={{ fontSize: '1rem', marginTop: '0.5rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                        "{p.excerpt.slice(0, 400)}{p.excerpt.length > 400 ? '...' : ''}"
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>Select a term from the list to view its definition and usage across the corpus.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
