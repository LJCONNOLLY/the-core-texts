import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import lunr from 'lunr';
import { loadIndex, loadBook } from '../utils/data';

export default function Search() {
  const [index, setIndex] = useState(null);
  const [lunrIdx, setLunrIdx] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [exactPhrase, setExactPhrase] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const booksCache = useRef({});
  const debounceRef = useRef(null);

  useEffect(() => {
    async function init() {
      const idx = await loadIndex();
      setIndex(idx);

      // Build Lunr index from book metadata for quick search
      // Full text search loads books on demand
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

    const searchResults = [];
    const queryLower = q.toLowerCase();

    // Search through all books' full text
    for (const book of index.books) {
      try {
        if (!booksCache.current[book.id]) {
          booksCache.current[book.id] = await loadBook(book.id);
        }
        const bookData = booksCache.current[book.id];

        for (const page of bookData.pages) {
          const textLower = page.text.toLowerCase();
          let matchIndex;

          if (exactPhrase) {
            matchIndex = textLower.indexOf(queryLower);
          } else {
            const words = queryLower.split(/\s+/);
            matchIndex = words.every(w => textLower.includes(w))
              ? textLower.indexOf(words[0]) : -1;
          }

          if (matchIndex !== -1) {
            const start = Math.max(0, matchIndex - 80);
            const end = Math.min(page.text.length, matchIndex + q.length + 80);
            searchResults.push({
              bookId: book.id,
              title: book.title,
              author: (book.author || []).join(', '),
              locator: page.locator,
              locatorType: page.locator_type,
              excerpt: page.text.slice(start, end),
              matchIndex: matchIndex - start,
            });
          }

          if (searchResults.length >= 100) break;
        }
      } catch {
        // Skip books that fail to load
      }
      if (searchResults.length >= 100) break;
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
            {results.length}{results.length >= 100 ? '+' : ''} results
          </p>
          {results.map((r, i) => (
            <Link key={i} to={`/book/${r.bookId}`} style={{ textDecoration: 'none', display: 'block' }}>
              <div className="card" style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '0.95rem' }}>{r.title}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.author}</p>
                  </div>
                  <span className="tag">{r.locatorType} {r.locator}</span>
                </div>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
                  ...{highlightText(r.excerpt, query)}...
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

function highlightText(text, query) {
  if (!query) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i}>{part}</mark>
      : part
  );
}
