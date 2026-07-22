import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { loadIndex, loadBook, getNotes, setNotes } from '../utils/data';
import { highlightText } from '../utils/text';

export default function BookProfile() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const locatorParam = searchParams.get('locator');
  const [meta, setMeta] = useState(null);
  const [book, setBook] = useState(null);
  const [page, setPage] = useState(0);
  const [notes, setLocalNotes] = useState('');
  const [keyArgs, setKeyArgs] = useState('');
  const [localSearch, setLocalSearch] = useState('');

  useEffect(() => {
    loadIndex().then(idx => {
      const found = idx.books.find(b => b.id === id);
      setMeta(found);
    });
    loadBook(id).then(setBook).catch(() => {});
    setLocalNotes(getNotes(id));
    setKeyArgs(localStorage.getItem(`coretexts-keyargs-${id}`) || '');
  }, [id]);

  // Deep link from search results: jump straight to the matched page/section.
  useEffect(() => {
    if (!book || !locatorParam) return;
    const target = Number(locatorParam);
    const idx = (book.pages || []).findIndex(p => p.locator === target);
    if (idx >= 0) setPage(idx);
  }, [book, locatorParam]);

  const handleNotesChange = useCallback((e) => {
    const val = e.target.value;
    setLocalNotes(val);
    setNotes(id, val);
  }, [id]);

  const handleKeyArgsChange = useCallback((e) => {
    const val = e.target.value;
    setKeyArgs(val);
    localStorage.setItem(`coretexts-keyargs-${id}`, val);
  }, [id]);

  if (!meta) return <div className="loading">Loading...</div>;

  const allPages = book?.pages || [];

  // Find the first section that starts with Introduction or a numbered chapter.
  // Skipped when arriving via a search deep link — the match may be in front
  // matter (dedication, epigraph, acknowledgments) that this trim would hide.
  const INTRO_RE = /^(Introduction|Chapter\s+1|Part\s+(One|1|I)\b|1\s+[A-Z])/im;
  const introIdx = allPages.findIndex(p => INTRO_RE.test(p.text.trim().slice(0, 200)));
  const pages = locatorParam ? allPages : (introIdx > 0 ? allPages.slice(introIdx) : allPages);
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

      {/* Table of Contents */}
      {book?.toc && book.toc.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Table of Contents</h2>
          <nav>
            {book.toc.filter(e => e.section && pages.some(p => p.locator === e.section)).map((entry, i) => {
              const targetIdx = pages.findIndex(p => p.locator === entry.section);
              return (
                <div key={i} style={{
                  paddingLeft: `${entry.level * 1.5}rem`,
                  marginBottom: '0.5rem',
                }}>
                  <button
                    onClick={() => { if (targetIdx >= 0) setPage(targetIdx); }}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      fontFamily: 'var(--font-heading)',
                      fontSize: '1.1rem',
                      color: targetIdx >= 0 ? '#1a2b4d' : 'var(--text-muted)',
                      cursor: targetIdx >= 0 ? 'pointer' : 'default',
                      textDecoration: targetIdx >= 0 ? 'underline' : 'none',
                      textDecorationColor: '#6fa8d9',
                      textUnderlineOffset: '3px',
                      textAlign: 'left',
                    }}
                    disabled={targetIdx < 0}
                  >
                    {entry.title}
                  </button>
                </div>
              );
            })}
          </nav>
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
                maxWidth: '920px',
                width: '100%',
                padding: '48px 1px',
                fontSize: '21px',
                lineHeight: '1.75',
                color: '#1a1a1a',
                fontFamily: 'Georgia, "Times New Roman", serif',
                textAlign: 'justify',
                hyphens: 'auto',
                WebkitHyphens: 'auto',
              }}>
                <FormattedText text={currentPage.text} pages={pages} onNavigate={setPage} />
              </div>
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)' }}>Loading text...</p>
        )}
      </div>

      {/* Definitions */}
      {meta.definitions && (meta.definitions.text?.length > 0 || meta.definitions.technology?.length > 0) && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--coral, #3f7fc4)' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>Definitions Found</h2>
          {meta.definitions.text?.map((d, i) => (
            <div key={`t${i}`} style={{ marginBottom: '0.75rem' }}>
              <span className="tag tag-gold" style={{ marginRight: '0.5rem' }}>text</span>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                {d.locator_type} {d.locator}
              </span>
              <p style={{ fontSize: '1rem', marginTop: '0.25rem', fontStyle: 'italic' }}>
                "{d.excerpt.slice(0, 300)}{d.excerpt.length > 300 ? '...' : ''}"
              </p>
            </div>
          ))}
          {meta.definitions.technology?.map((d, i) => (
            <div key={`k${i}`} style={{ marginBottom: '0.75rem' }}>
              <span className="tag" style={{ background: '#e3f2fd', color: '#1565c0', marginRight: '0.5rem' }}>technology</span>
              <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>
                {d.locator_type} {d.locator}
              </span>
              <p style={{ fontSize: '1rem', marginTop: '0.25rem', fontStyle: 'italic' }}>
                "{d.excerpt.slice(0, 300)}{d.excerpt.length > 300 ? '...' : ''}"
              </p>
            </div>
          ))}
        </div>
      )}

      {/* My Key Arguments */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.75rem' }}>My Key Arguments</h2>
        <textarea
          className="input"
          rows={6}
          placeholder="Write your key arguments for this text..."
          value={keyArgs}
          onChange={handleKeyArgsChange}
          style={{ resize: 'vertical' }}
        />
        <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
          Saved to your browser's local storage.
        </p>
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

const HEADING_RE = /^(Acknowledgments?|Contents|Table of Contents|Introduction|Conclusion|Preface|Prologue|Epilogue|Afterword|Foreword|Bibliography|References|Notes|Appendix|Glossary|Index|Abstract|Summary|Dedication|Epigraph|Chapter|Part|Section)\b/i;

function isHeadingLine(line) {
  const t = line.trim();
  if (!t || t.length > 100) return false;
  if (t.endsWith('.') || t.endsWith(',') || t.endsWith(';')) return false;
  // Must be a short standalone line, not a sentence
  const wordCount = t.split(/\s+/).length;
  if (wordCount > 12) return false;
  // Numbered chapter heading like "5 From #Ferguson to..."
  if (/^\d+\s+[A-Z]/.test(t) && t.length < 80) return true;
  // Known heading words — but only if the line is short (not a sentence starting with the word)
  if (HEADING_RE.test(t) && wordCount <= 8) return true;
  // ALL CAPS short lines
  if (t === t.toUpperCase() && /[A-Z]/.test(t) && t.length < 60 && t.length > 2 && wordCount <= 6) return true;
  return false;
}

function FormattedText({ text, pages, onNavigate }) {
  const hasDoubleNewlines = /\n\s*\n/.test(text);

  let paragraphs;

  if (hasDoubleNewlines) {
    // Split on double newlines, then scan each block for headings
    paragraphs = [];
    for (const block of text.split(/\n\s*\n/)) {
      const lines = block.split(/\n/).map(l => l.trim()).filter(Boolean);
      let currentChunk = [];
      for (const line of lines) {
        if (isHeadingLine(line)) {
          if (currentChunk.length > 0) {
            paragraphs.push(currentChunk.join(' '));
            currentChunk = [];
          }
          paragraphs.push(line);
        } else {
          currentChunk.push(line);
        }
      }
      if (currentChunk.length > 0) paragraphs.push(currentChunk.join(' '));
    }
    paragraphs = paragraphs.filter(Boolean);
  } else {
    const lines = text.split(/\n/);
    const joined = [];
    let current = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) {
        if (current) { joined.push(current); current = ''; }
        continue;
      }

      if (isHeadingLine(line)) {
        if (current) { joined.push(current); current = ''; }
        joined.push(line);
        continue;
      }

      if (!current) { current = line; continue; }

      const prevEndsWithPunctuation = /[.!?:;")\u201d]\s*$/.test(current);
      const lineStartsWithUpper = /^[A-Z\u201c"(]/.test(line);
      const lineIsShort = line.length < 40;
      const currentIsShort = current.length < 40;
      const lineStartsWithLower = /^[a-z,;]/.test(line);

      if (lineStartsWithLower || (!prevEndsWithPunctuation && !lineIsShort)) {
        current += ' ' + line;
      } else if (prevEndsWithPunctuation && lineStartsWithUpper && !currentIsShort) {
        joined.push(current);
        current = line;
      } else {
        current += ' ' + line;
      }
    }
    if (current) joined.push(current);
    paragraphs = joined;
  }

  if (paragraphs.length <= 1 && text.length > 500) {
    const sentences = text.replace(/\n/g, ' ').match(/[^.!?]+[.!?]+\s*/g) || [text];
    const grouped = [];
    for (let i = 0; i < sentences.length; i += 4) {
      grouped.push(sentences.slice(i, i + 4).join(''));
    }
    paragraphs = grouped;
  }

  return (
    <>
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        if (!trimmed) return null;

        if (isHeadingLine(trimmed)) {
          const handleClick = () => {
            if (!pages || !onNavigate) return;
            // Strip leading number from heading like "1  Women Tweet..."
            const searchText = trimmed.replace(/^\d+\s+/, '').trim().toLowerCase();
            // Search all pages for one where the text starts with or contains this heading
            for (let pi = 0; pi < pages.length; pi++) {
              const pageText = pages[pi].text.toLowerCase();
              // Check if this page's text contains a substantial match
              if (pageText.includes(searchText)) {
                onNavigate(pi);
                return;
              }
              // Also try matching just the first 40 chars of the heading
              if (searchText.length > 20 && pageText.includes(searchText.slice(0, 40))) {
                onNavigate(pi);
                return;
              }
            }
          };

          const isClickable = pages && onNavigate;

          return (
            <h3 key={i}
              onClick={isClickable ? handleClick : undefined}
              style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '28px',
                fontWeight: 700,
                marginTop: i === 0 ? 0 : '2.5rem',
                marginBottom: '1rem',
                lineHeight: 1.3,
                textAlign: 'center',
                color: isClickable ? '#1a2b4d' : '#1a1a1a',
                cursor: isClickable ? 'pointer' : 'default',
                textDecoration: isClickable ? 'underline' : 'none',
                textDecorationColor: isClickable ? '#6fa8d9' : 'transparent',
                textUnderlineOffset: '4px',
              }}>
              {trimmed}
            </h3>
          );
        }

        const isFootnote = /^\d{1,3}\.\s/.test(trimmed);

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

        const prevIsHeading = i > 0 && isHeadingLine(paragraphs[i - 1]?.trim());

        return (
          <p key={i} style={{
            textIndent: prevIsHeading || i === 0 ? 0 : '2em',
            marginBottom: '0.15rem',
          }}>
            {trimmed}
          </p>
        );
      })}
    </>
  );
}
