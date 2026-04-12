import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { loadIndex, getApiKey } from '../utils/data';
import { generateSynthesis } from '../utils/api';

export default function TextsTechnology() {
  const [index, setIndex] = useState(null);
  const [synthesis, setSynthesis] = useState(null);
  const [synthLoading, setSynthLoading] = useState(false);
  const [synthError, setSynthError] = useState('');
  const [activeTab, setActiveTab] = useState('text');

  useEffect(() => {
    loadIndex().then(setIndex);
  }, []);

  if (!index) return <div className="loading">Loading...</div>;

  // Collect all definitions across all books
  const textDefs = [];
  const techDefs = [];

  index.books.forEach(book => {
    (book.definitions?.text || []).forEach(d => {
      textDefs.push({
        ...d,
        book: book.title,
        bookId: book.id,
        author: (book.author || []).join(', '),
        year: book.year,
      });
    });
    (book.definitions?.technology || []).forEach(d => {
      techDefs.push({
        ...d,
        book: book.title,
        bookId: book.id,
        author: (book.author || []).join(', '),
        year: book.year,
      });
    });
  });

  // Sort alphabetically by author
  textDefs.sort((a, b) => a.author.localeCompare(b.author));
  techDefs.sort((a, b) => a.author.localeCompare(b.author));

  const handleGenerateSynthesis = async () => {
    if (!getApiKey()) { setSynthError('Set your API key in Settings first.'); return; }
    setSynthLoading(true);
    setSynthError('');
    try {
      const result = await generateSynthesis(textDefs, techDefs);
      setSynthesis(result);
    } catch (e) {
      setSynthError(e.message);
    }
    setSynthLoading(false);
  };

  const tabs = [
    { key: 'text', label: `Definitions of "Text" (${textDefs.length})` },
    { key: 'technology', label: `Definitions of "Technology" (${techDefs.length})` },
    { key: 'synthesis', label: 'Synthesis' },
  ];

  const activeDefs = activeTab === 'text' ? textDefs : activeTab === 'technology' ? techDefs : [];

  return (
    <div>
      <div className="page-header">
        <h1>Texts & Technology</h1>
        <p>How "text" and "technology" are defined across the corpus</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '0' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.6rem 1rem',
              border: 'none',
              background: 'none',
              color: activeTab === tab.key ? 'var(--navy)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.key ? 600 : 400,
              fontSize: '0.875rem',
              cursor: 'pointer',
              borderBottom: activeTab === tab.key ? '2px solid var(--gold)' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {(activeTab === 'text' || activeTab === 'technology') && (
        <div>
          {activeDefs.length === 0 ? (
            <div className="empty-state">
              <p>No definitional passages found for "{activeTab}" in the corpus.</p>
            </div>
          ) : (
            activeDefs.map((d, i) => (
              <div key={i} className="card" style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <Link to={`/book/${d.bookId}`} style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {d.book}
                    </Link>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {d.author} ({d.year || 'n.d.'})
                    </p>
                  </div>
                  <span className="tag">{d.locator_type} {d.locator}</span>
                </div>
                <blockquote style={{
                  marginTop: '0.75rem',
                  paddingLeft: '1rem',
                  borderLeft: '3px solid var(--gold)',
                  fontSize: '0.875rem',
                  lineHeight: 1.7,
                  color: 'var(--text-secondary)',
                  fontStyle: 'italic',
                }}>
                  {d.excerpt}
                </blockquote>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'synthesis' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <button className="btn btn-gold" onClick={handleGenerateSynthesis} disabled={synthLoading}>
              {synthLoading ? 'Generating...' : (synthesis ? 'Regenerate Synthesis' : 'Generate Synthesis')}
            </button>
          </div>

          {synthError && <p style={{ color: '#c0392b', fontSize: '0.85rem', marginBottom: '1rem' }}>{synthError}</p>}

          {synthesis ? (
            <div>
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>How "Text" Is Defined</h3>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>{synthesis.text_synthesis}</p>
              </div>

              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>How "Technology" Is Defined</h3>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>{synthesis.technology_synthesis}</p>
              </div>

              <div className="card" style={{ borderLeft: '3px solid var(--gold)' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Convergence & Divergence</h3>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>{synthesis.comparative}</p>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <p>Click "Generate Synthesis" to create a comparative analysis using Claude.</p>
              <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Drawing from {textDefs.length} "text" definitions and {techDefs.length} "technology" definitions.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
