import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { loadIndex, loadBook, getNotes, setNotes, getApiKey } from '../utils/data';
import { generateBookArguments } from '../utils/api';

export default function BookProfile() {
  const { id } = useParams();
  const [meta, setMeta] = useState(null);
  const [book, setBook] = useState(null);
  const [page, setPage] = useState(0);
  const [notes, setLocalNotes] = useState('');
  const [args, setArgs] = useState(null);
  const [argsLoading, setArgsLoading] = useState(false);
  const [argsError, setArgsError] = useState('');
  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => {
    loadIndex().then(idx => {
      const found = idx.books.find(b => b.id === id);
      setMeta(found);
    });
    loadBook(id).then(setBook).catch(() => {});
    setLocalNotes(getNotes(id));
  }, [id]);

  const handleNotesChange = useCallback((e) => {
    const val = e.target.value;
    setLocalNotes(val);
    setNotes(id, val);
  }, [id]);

  const handleGenerateArgs = async () => {
    if (!getApiKey()) { setArgsError('Set your API key in Settings first.'); return; }
    setArgsLoading(true);
    setArgsError('');
    try {
      const result = await generateBookArguments(meta, book);
      setArgs(result);
    } catch (e) {
      setArgsError(e.message);
    }
    setArgsLoading(false);
  };

  if (!meta) return <div className="loading">Loading...</div>;

  const allPages = book?.pages || [];

  // Skip front matter: find first page with actual prose content
  const firstContentIndex = allPages.findIndex(p => !isFrontMatter(p.text));
  const pages = firstContentIndex > 0 ? allPages.slice(firstContentIndex) : allPages;
  const currentPage = pages[page];

  const filteredPages = localSearch
    ? pages.filter(p => p.text.toLowerCase().includes(localSearch.toLowerCase()))
    : null;

  return (
    <div>
      <Link to="/" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>&larr; Back to Library</Link>

      <div style={{ marginTop: '1rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{meta.title}</h1>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
              {(meta.author || []).join(', ')}
            </p>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>
              {meta.year || 'n.d.'}{meta.publisher ? ` • ${meta.publisher}` : ''}
              {meta.isbn ? ` • ISBN ${meta.isbn}` : ''}
            </p>
          </div>
          <span className={`format-badge ${meta.format}`} style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem' }}>
            {meta.format}
          </span>
        </div>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          {meta.page_count} {meta.format === 'epub' || meta.format === 'mobi' || meta.format === 'azw3' ? 'sections' : 'pages'}
          {' • '}{(meta.word_count || 0).toLocaleString()} words
        </p>
      </div>

      {/* Key Arguments */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.2rem' }}>Key Arguments</h2>
          <button className="btn btn-secondary" onClick={handleGenerateArgs} disabled={argsLoading}>
            {argsLoading ? 'Generating...' : (args ? 'Regenerate' : 'Generate with AI')}
          </button>
        </div>
        {argsError && <p style={{ color: '#c0392b', fontSize: '0.85rem' }}>{argsError}</p>}
        {args ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {args.map((arg, i) => (
              <li key={i} style={{ marginBottom: '1rem', paddingLeft: '1rem', borderLeft: '3px solid var(--gold)' }}>
                <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{arg.summary}</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{arg.elaboration}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Click "Generate with AI" to produce key arguments using Claude.
          </p>
        )}
      </div>

      {/* Definitions */}
      {meta.definitions && (meta.definitions.text?.length > 0 || meta.definitions.technology?.length > 0) && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--gold)' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Definitions Found</h2>
          {meta.definitions.text?.map((d, i) => (
            <div key={`t${i}`} style={{ marginBottom: '0.75rem' }}>
              <span className="tag tag-gold" style={{ marginRight: '0.5rem' }}>text</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {d.locator_type} {d.locator}
              </span>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem', fontStyle: 'italic' }}>
                "{d.excerpt.slice(0, 300)}{d.excerpt.length > 300 ? '...' : ''}"
              </p>
            </div>
          ))}
          {meta.definitions.technology?.map((d, i) => (
            <div key={`k${i}`} style={{ marginBottom: '0.75rem' }}>
              <span className="tag" style={{ background: '#e3f2fd', color: '#1565c0', marginRight: '0.5rem' }}>technology</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {d.locator_type} {d.locator}
              </span>
              <p style={{ fontSize: '0.85rem', marginTop: '0.25rem', fontStyle: 'italic' }}>
                "{d.excerpt.slice(0, 300)}{d.excerpt.length > 300 ? '...' : ''}"
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Full Text */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.2rem' }}>Full Text</h2>
          <input
            className="input"
            style={{ maxWidth: '250px' }}
            placeholder="Search in this book..."
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
          />
        </div>

        {filteredPages ? (
          <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              {filteredPages.length} {filteredPages.length === 1 ? 'result' : 'results'} for "{localSearch}"
            </p>
            {filteredPages.slice(0, 20).map(p => {
              const idx = p.text.toLowerCase().indexOf(localSearch.toLowerCase());
              const start = Math.max(0, idx - 100);
              const end = Math.min(p.text.length, idx + localSearch.length + 100);
              const snippet = p.text.slice(start, end);
              return (
                <div key={p.locator} style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                    {p.locator_type} {p.locator}
                  </span>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                    ...{highlightText(snippet, localSearch)}...
                  </p>
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: '0.5rem', fontSize: '1rem', padding: '0.25rem 0.5rem' }}
                    onClick={() => { setLocalSearch(''); setPage(pages.indexOf(p)); }}
                  >
                    Go to {p.locator_type} {p.locator}
                  </button>
                </div>
              );
            })}
          </div>
        ) : currentPage ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <button className="btn btn-secondary" onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>
                &larr; Prev
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {currentPage.locator_type} {currentPage.locator} of {pages.length}
              </span>
              <button className="btn btn-secondary" onClick={() => setPage(Math.min(pages.length - 1, page + 1))} disabled={page >= pages.length - 1}>
                Next &rarr;
              </button>
            </div>
            <div style={{
              maxHeight: '800px',
              overflowY: 'auto',
              background: '#fff',
              borderRadius: '6px',
              display: 'flex',
              justifyContent: 'center',
            }}>
              <div style={{
                maxWidth: '680px',
                width: '100%',
                padding: '48px 40px',
                fontSize: '18px',
                lineHeight: '1.75',
                color: '#1a1a1a',
                fontFamily: 'Georgia, "Times New Roman", serif',
                textAlign: 'justify',
                hyphens: 'auto',
                WebkitHyphens: 'auto',
              }}>
                <FormattedText text={currentPage.text} />
              </div>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>Loading text...</p>
        )}
      </div>

      {/* Notes */}
      <div className="card">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Personal Notes</h2>
        <textarea
          className="input"
          rows={6}
          placeholder="Add your notes about this text..."
          value={notes}
          onChange={handleNotesChange}
          style={{ resize: 'vertical' }}
        />
        <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Saved to your browser's local storage.
        </p>
      </div>
    </div>
  );
}

function highlightText(text, query) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i}>{part}</mark>
      : part
  );
}

const FRONT_MATTER_PATTERNS = [
  /isbn/i, /copyright/i, /all rights reserved/i, /library of congress/i,
  /cataloging.in.publication/i, /printed in/i, /typeset/i, /press\./i,
  /\d{3}-\d{1,5}-\d{1,7}-\d{1,7}-\d{1}/,  // ISBN pattern
  /^\s*\d{1,2}\s+\d{1,2}\s+\d{1,2}\s+\d{1,2}/, // classification codes
  /published by/i, /first (edition|printing|published)/i,
  /cover design/i, /jacket/i, /manufactured/i,
];

function isFrontMatter(text) {
  if (!text) return true;
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return true;
  if (lines.length < 3) return true; // Very short pages are likely front matter

  let metaLineCount = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length < 5) { metaLineCount++; continue; }
    if (FRONT_MATTER_PATTERNS.some(p => p.test(trimmed))) { metaLineCount++; }
  }

  return metaLineCount / lines.length > 0.5;
}

function FormattedText({ text }) {
  // Try double newlines first; if that gives only 1 block, split on single newlines
  let paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());

  if (paragraphs.length <= 1) {
    paragraphs = text.split(/\n/).filter(p => p.trim());
  }

  // If still one block, split on sentence boundaries
  if (paragraphs.length <= 1 && text.length > 500) {
    paragraphs = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
    const grouped = [];
    for (let i = 0; i < paragraphs.length; i += 3) {
      grouped.push(paragraphs.slice(i, i + 3).join(''));
    }
    paragraphs = grouped;
  }

  return (
    <>
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        // Detect chapter/section headings: short lines, often numbered or all caps
        const isHeading = (
          trimmed.length < 120 &&
          (/^\d+\s+[A-Z]/.test(trimmed) || /^(Chapter|Part|Section|Introduction|Conclusion|Preface|Prologue|Epilogue|Afterword|Foreword)\b/i.test(trimmed)) &&
          !trimmed.endsWith('.')
        );

        if (isHeading) {
          return (
            <h3 key={i} style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '24px',
              fontWeight: 700,
              marginTop: i === 0 ? 0 : '2.5rem',
              marginBottom: '1.5rem',
              lineHeight: 1.3,
              textAlign: 'left',
              color: '#1a1a1a',
            }}>
              {trimmed}
            </h3>
          );
        }

        // Detect footnote/list lines
        const isFootnote = /^\d{1,3}\.\s/.test(trimmed) || /^\d{1,3}\s+[A-Z]/.test(trimmed) && trimmed.length < 200;

        if (isFootnote) {
          return (
            <p key={i} style={{
              marginBottom: '0.4rem',
              fontSize: '15px',
              color: '#666',
              textIndent: 0,
            }}>
              {trimmed}
            </p>
          );
        }

        return (
          <p key={i} style={{
            textIndent: i === 0 || paragraphs[i - 1]?.trim().length < 120 ? 0 : '2em',
            marginBottom: '0.15rem',
          }}>
            {trimmed}
          </p>
        );
      })}
    </>
  );
}
