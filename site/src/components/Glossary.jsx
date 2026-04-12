import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { loadIndex, getApiKey } from '../utils/data';
import { generateGlossaryEntry } from '../utils/api';

const DEFAULT_TERMS = [
  'text', 'technology', 'discourse', 'remediation', 'misogynoir',
  'design justice', 'coding literacy', 'episteme', 'cultural analytics',
  'algorithmic oppression', 'digital blackness', 'posthuman',
  'actor-network', 'situated knowledge', 'encoding/decoding'
];

export default function Glossary() {
  const [index, setIndex] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState(null);
  const [entry, setEntry] = useState(null);
  const [entryLoading, setEntryLoading] = useState(false);
  const [entryError, setEntryError] = useState('');
  const [bookPassages, setBookPassages] = useState([]);

  useEffect(() => {
    loadIndex().then(setIndex);
  }, []);

  useEffect(() => {
    if (!selectedTerm || !index) return;
    // Find passages containing this term across all books
    const passages = [];
    for (const book of index.books) {
      // Check definitions
      for (const key of ['text', 'technology']) {
        if (book.definitions?.[key]) {
          for (const def of book.definitions[key]) {
            if (def.excerpt.toLowerCase().includes(selectedTerm.toLowerCase())) {
              passages.push({
                book: book.title,
                bookId: book.id,
                author: (book.author || []).join(', '),
                locator: def.locator,
                locatorType: def.locator_type,
                excerpt: def.excerpt,
              });
            }
          }
        }
      }
    }
    setBookPassages(passages);
  }, [selectedTerm, index]);

  const handleGenerate = async () => {
    if (!getApiKey()) { setEntryError('Set your API key in Settings first.'); return; }
    setEntryLoading(true);
    setEntryError('');
    try {
      const result = await generateGlossaryEntry(selectedTerm, bookPassages);
      setEntry(result);
    } catch (e) {
      setEntryError(e.message);
    }
    setEntryLoading(false);
  };

  if (!index) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Concept Glossary</h1>
        <p>Key theoretical terms from the reading list</p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ width: '220px', flexShrink: 0 }}>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Terms
          </h3>
          {DEFAULT_TERMS.sort().map(term => (
            <button
              key={term}
              onClick={() => { setSelectedTerm(term); setEntry(null); setEntryError(''); }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.5rem 0.75rem',
                border: 'none',
                background: selectedTerm === term ? 'var(--white)' : 'transparent',
                color: selectedTerm === term ? 'var(--navy)' : 'var(--text-secondary)',
                fontWeight: selectedTerm === term ? 600 : 400,
                fontSize: '0.875rem',
                borderRadius: '4px',
                borderLeft: selectedTerm === term ? '3px solid var(--gold)' : '3px solid transparent',
                cursor: 'pointer',
                marginBottom: '0.15rem',
              }}
            >
              {term}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: '300px' }}>
          {selectedTerm ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem' }}>{selectedTerm}</h2>
                <button className="btn btn-gold" onClick={handleGenerate} disabled={entryLoading}>
                  {entryLoading ? 'Generating...' : (entry ? 'Regenerate' : 'Generate Definition')}
                </button>
              </div>

              {entryError && <p style={{ color: '#c0392b', fontSize: '0.85rem', marginBottom: '1rem' }}>{entryError}</p>}

              {entry && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Synthesized Definition</h3>
                  <p style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>{entry.definition}</p>
                  {entry.usage_notes && (
                    <div style={{ marginTop: '1rem' }}>
                      <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Usage Notes</h4>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{entry.usage_notes}</p>
                    </div>
                  )}
                  {entry.related_terms?.length > 0 && (
                    <div style={{ marginTop: '1rem', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      {entry.related_terms.map(t => (
                        <button
                          key={t}
                          className="tag tag-gold"
                          onClick={() => { setSelectedTerm(t.toLowerCase()); setEntry(null); }}
                          style={{ cursor: 'pointer', border: 'none' }}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {bookPassages.length > 0 && (
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
                    Found in {bookPassages.length} passages
                  </h3>
                  {bookPassages.map((p, i) => (
                    <div key={i} className="card" style={{ marginBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <Link to={`/book/${p.bookId}`} style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            {p.book}
                          </Link>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.author}</p>
                        </div>
                        <span className="tag">{p.locatorType} {p.locator}</span>
                      </div>
                      <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                        "{p.excerpt.slice(0, 300)}{p.excerpt.length > 300 ? '...' : ''}"
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {bookPassages.length === 0 && !entry && (
                <div className="empty-state">
                  <p>No extracted passages found for this term in the corpus definitions.</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    Click "Generate Definition" to create a synthesized entry using Claude.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>Select a term from the list to view its definition and usage.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
