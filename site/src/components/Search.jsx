import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import lunr from 'lunr';
import { loadIndex } from '../utils/data';
import { search as searchIndex, tokenize } from '../utils/search';
import { highlightText } from '../utils/text';

export default function Search() {
  const [index, setIndex] = useState(null);
  const [lunrIdx, setLunrIdx] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [exactPhrase, setExactPhrase] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    async function init() {
      const idx = await loadIndex();
      setIndex(idx);

      // Build Lunr index from book metadata for quick title/author search
      const lunrIndex = lunr(function () {
        this.ref('id');
        this.field('title', { boost: 10 });
        this.field('author', { boost: 5 });

        idx.books.forEach(b => {
          this.add({
            id: b.id,
            title: b.title,
            author: (b.author || []).join(' '),
          });
        });
      });

      setLunrIdx(lunrIndex);
      setLoading(false);
    }
    init();
  }, []);

  const performSearch = useCallback(async (q) => {
    if (!q.trim() || !index) { setResults([]); return; }
    setSearching(true);

    const booksById = Object.fromEntries(index.books.map(b => [b.id, b]));

    let searchResults = [];
    try {
      const hits = await searchIndex(q, { exactPhrase });
      searchResults = hits
        .filter(h => booksById[h.bookId])
        .map(h => ({
          bookId: h.bookId,
          title: booksById[h.bookId].title,
          author: (booksById[h.bookId].author || []).join(', '),
          locator: h.locator,
          locatorType: h.locatorType,
          excerpt: h.snippet,
        }));
    } catch {
      // Search index unavailable — fail closed to no results
    }

    setResults(searchResults);
    setSearching(false);
  }, [index, exactPhrase]);

  const handleQueryChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(val), 500);
  };

  if (loading) return <div className="loading">Loading search index...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Search</h1>
        <p>Search across all {index.books.length} texts</p>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <input
          className="input"
          style={{ fontSize: '1.1rem', padding: '0.8rem 1rem' }}
          placeholder="Search for a term, concept, or phrase..."
          value={query}
          onChange={handleQueryChange}
          autoFocus
        />
        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="radio"
              checked={!exactPhrase}
              onChange={() => setExactPhrase(false)}
            />
            Keyword search
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="radio"
              checked={exactPhrase}
              onChange={() => setExactPhrase(true)}
            />
            Exact phrase
          </label>
        </div>
      </div>

      {searching && <div className="loading">Searching...</div>}

      {!searching && results.length > 0 && (
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {results.length} result{results.length === 1 ? '' : 's'}, ranked by relevance
          </p>
          {results.map((r, i) => (
            <Link
              key={i}
              to={`/book/${r.bookId}?locator=${r.locator}`}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div className="card" style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem' }}>{r.title}</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{r.author}</p>
                  </div>
                  <span className="tag">{r.locatorType} {r.locator}</span>
                </div>
                <p style={{ fontSize: '0.95rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                  ...{highlightText(r.excerpt, exactPhrase ? query : tokenize(query))}...
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {!searching && query && results.length === 0 && (
        <div className="empty-state">
          <p>No results found for "{query}"</p>
        </div>
      )}
    </div>
  );
}
