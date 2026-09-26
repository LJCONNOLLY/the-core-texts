import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { loadTerm, loadTermIndex } from '../utils/data';
import { useRemembered, useReviews } from '../utils/reviews';
import { ClaudeReading, ExportChecks, Quote } from './Evidence';

const STANCE = {
  defines: 'Defines it',
  'in passing': 'Uses it in passing',
  critiques: 'Critiques a use of it',
};

const shortTitle = t => t.replace(/\s*\(.*\)$/, '').replace(/:.*$/, '');
const authorsOf = b => b.authors.join(', ');

export default function TermEvolution() {
  const { termId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const reviews = useReviews('terms');
  const [last, setLast] = useRemembered('terms-last', null);
  const [index, setIndex] = useState(null);
  const [loaded, setLoaded] = useState({});
  const [error, setError] = useState(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    loadTermIndex().then(setIndex).catch(e => setError(e.message));
  }, []);

  // Arriving without a term: go back to where you left off
  useEffect(() => {
    if (termId || !index) return;
    const first = Object.keys(index.terms)[0];
    const to = last?.term && index.terms[last.term] ? last : { term: first };
    navigate(`/terms/${to.term}${to.book ? `?book=${to.book}` : ''}`, { replace: true });
  }, [termId, index, last, navigate]);

  useEffect(() => {
    if (!termId) return;
    loadTerm(termId)
      .then(d => setLoaded(prev => ({ ...prev, [termId]: d })))
      .catch(e => setError(e.message));
  }, [termId]);
  const data = loaded[termId];

  const books = data?.books || [];
  const firstUsing = books.find(b => b.uses > 0)?.bookId;
  const bookId = params.get('book') || (last && last.term === termId && last.book) || firstUsing;
  const compareId = params.get('compare');
  const at = Math.max(0, books.findIndex(b => b.bookId === bookId));
  const current = books[at];
  const other = books.find(b => b.bookId === compareId);

  const select = (id, asCompare = false) => {
    const next = {};
    if (asCompare) {
      next.book = current.bookId;
      next.compare = id;
    } else {
      next.book = id;
      if (compareId && compareId !== id) next.compare = compareId;
    }
    setParams(next);
    setLast({ term: termId, book: next.book });
  };

  const step = d => {
    const k = at + d;
    if (k >= 0 && k < books.length) select(books[k].bookId);
  };

  // Arrow keys move along the timeline
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; });
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); stepRef.current(1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); stepRef.current(-1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (error) return <div className="empty-state"><p>Could not load the term timelines: {error}</p></div>;
  if (!index || !data || !current) return <div className="loading">Loading…</div>;

  const pick = id => {
    if (comparing && id !== current.bookId) {
      select(id, true);
      setComparing(false);
    } else {
      select(id);
    }
  };

  return (
    <div className="te">
      <div className="te-head">
        <div>
          <h1>How the term evolved in these readings</h1>
          <p className="te-sub">Pick a term, then walk the books in the order they first came out.</p>
        </div>
        <ExportChecks reviews={reviews} tab="terms" />
      </div>

      <TermPicker index={index} termId={termId} term={data.term} />

      <Timeline
        books={books}
        selected={current.bookId}
        compare={other?.bookId}
        term={data.term}
        onPick={pick}
      />

      <div className="te-controls">
        <button className="te-nav" onClick={() => step(-1)} disabled={at === 0}>
          <span aria-hidden="true">←</span> {at > 0 ? books[at - 1].year : 'Start'}
        </button>
        <span className="te-pos">{at + 1} of {books.length}</span>
        <button className="te-nav" onClick={() => step(1)} disabled={at === books.length - 1}>
          {at < books.length - 1 ? books[at + 1].year : 'End'} <span aria-hidden="true">→</span>
        </button>
        {other ? (
          <button className="te-compare on" onClick={() => setParams({ book: current.bookId })}>
            Stop comparing
          </button>
        ) : (
          <button
            className={`te-compare ${comparing ? 'on' : ''}`}
            aria-pressed={comparing}
            onClick={() => setComparing(c => !c)}
          >
            {comparing ? 'Now pick a second book ↑' : 'Compare two books'}
          </button>
        )}
      </div>

      <div className={other ? 'te-pair' : ''}>
        <BookCard key={current.bookId} book={current} term={data.term} termId={termId} reviews={reviews} tag={other ? 'A' : null} />
        {other && (
          <BookCard key={other.bookId} book={other} term={data.term} termId={termId} reviews={reviews} tag="B" />
        )}
      </div>
    </div>
  );
}

function TermPicker({ index, termId, term }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const navigate = useNavigate();
  const input = useRef(null);
  const terms = Object.entries(index.terms);
  const shown = terms.filter(([id, t]) => !q || t.term.toLowerCase().includes(q.toLowerCase()) || id.includes(q.toLowerCase()));

  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  const choose = id => {
    setOpen(false);
    setQ('');
    navigate(`/terms/${id}`);
  };

  return (
    <div className="te-picker">
      <div className="te-picker-row">
        <span className="te-picker-label">Term</span>
        <button className="te-term" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {term} <span aria-hidden="true" className="te-caret">▾</span>
        </button>
      </div>
      {open && (
        <div className="te-picker-panel" onKeyDown={e => e.key === 'Escape' && setOpen(false)}>
          <input
            ref={input}
            className="input te-search"
            placeholder="Search terms…"
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && shown[0] && choose(shown[0][0])}
            aria-label="Search terms"
          />
          <div className="te-term-grid">
            {shown.map(([id, t]) => (
              <button key={id} className={`te-term-option ${id === termId ? 'current' : ''}`} onClick={() => choose(id)}>
                {t.term}
                <span>{Object.values(t.uses).filter(Boolean).length} books</span>
              </button>
            ))}
            {shown.length === 0 && <p className="te-empty">No term matches “{q}”.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function Timeline({ books, selected, compare, term, onPick }) {
  const max = Math.max(1, ...books.map(b => b.uses));
  const scroller = useRef(null);
  const n = books.length;

  // Keep the chosen book in view on narrow screens, and keep keyboard focus
  // on it when the arrow keys moved the selection from within the timeline
  useEffect(() => {
    const el = scroller.current?.querySelector('[aria-current="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    if (document.activeElement?.classList.contains('tl-dot-btn')) el?.focus();
  }, [selected]);

  // Runs of books from the same year, labelled once under the whole run
  const groups = useMemo(() => {
    const out = [];
    books.forEach((b, k) => {
      if (out.length && out[out.length - 1].year === b.year) out[out.length - 1].last = k;
      else out.push({ year: b.year, first: k, last: k });
    });
    return out;
  }, [books]);
  const at = k => ((k + 0.5) / n) * 100;

  return (
    <div className="tl-wrap">
      <div className="tl-scroll" ref={scroller}>
        <div className="tl" style={{ minWidth: `${n * 28}px` }} role="group" aria-label="Books in order of first publication. Use the arrow keys to move.">
          <div className="tl-axis" aria-hidden="true" />
          {books.map((b, k) => {
            const size = b.uses ? 10 + 22 * Math.sqrt(b.uses / max) : 12;
            const left = `${at(k)}%`;
            const isSel = b.bookId === selected;
            const isCmp = b.bookId === compare;
            return (
              <button
                key={b.bookId}
                className={`tl-dot-btn ${b.uses ? '' : 'silent'} ${isSel ? 'sel' : ''} ${isCmp ? 'cmp' : ''}`}
                style={{ left }}
                aria-current={isSel ? 'true' : undefined}
                tabIndex={isSel ? 0 : -1}
                aria-label={`${b.year}, ${authorsOf(b)}, ${shortTitle(b.title)}: ${b.uses ? `uses “${term}” ${b.uses} times` : `never uses “${term}”`}`}
                title={`${b.year} · ${authorsOf(b)} · ${b.uses} uses`}
                onClick={() => onPick(b.bookId)}
              >
                <span className="tl-dot" style={{ width: size, height: size }} />
                {(isSel || isCmp) && compare && <span className="tl-tag">{isSel ? 'A' : 'B'}</span>}
              </button>
            );
          })}
          {groups.map(g => (
            <span key={g.year}>
              {g.last > g.first && (
                <span
                  className="tl-group"
                  aria-hidden="true"
                  style={{ left: `calc(${at(g.first)}% - 8px)`, width: `calc(${at(g.last) - at(g.first)}% + 16px)` }}
                />
              )}
              <span className="tl-year" style={{ left: `${(at(g.first) + at(g.last)) / 2}%` }}>
                {/* Single books sit close together: '82, '91 after the first year */}
                {g.last > g.first || g.first === 0 ? g.year : `’${String(g.year).slice(2)}`}
              </span>
            </span>
          ))}
        </div>
      </div>
      <p className="tl-legend">
        <span className="tl-legend-dot" /> bigger dot = uses “{term}” more
        <span className="tl-legend-dot hollow" /> never uses it
      </p>
    </div>
  );
}

function BookCard({ book, term, termId, reviews, tag }) {
  // Once opened, "What changed" stays open on every card
  const [showChanged, setShowChanged] = useRemembered('terms-show-changed', false);
  const edition = book.editionYear && book.editionYear !== book.year ? ` · your edition ${book.editionYear}` : '';
  return (
    <article className="tc" aria-live="polite">
      <header className="tc-head">
        {tag && <span className="tc-tag">{tag}</span>}
        <span className="tc-year">{book.year}</span>
        <div>
          <h2 className="tc-title">{shortTitle(book.title)}</h2>
          <p className="tc-author">{authorsOf(book)}<span className="tc-edition">{edition}</span></p>
        </div>
        <span className="tc-uses">{book.uses ? `${book.uses} uses` : 'no uses'}</span>
      </header>

      {book.quote ? (
        <>
          <ClaudeReading id={`${termId}/${book.bookId}`} reviews={reviews}>
            <p className="tc-def">{book.definition}</p>
            <p className="tc-stance">{STANCE[book.stance] || book.stance}</p>
            {book.changed && (showChanged ? (
              <p className="tc-changed"><b>What changed:</b> {book.changed}</p>
            ) : (
              <button className="tc-more" onClick={() => setShowChanged(true)}>
                What changed from earlier books? <span aria-hidden="true">▸</span>
              </button>
            ))}
          </ClaudeReading>
          <Quote text={book.quote} bookId={book.bookId} locator={book.locator} page={book.page} />
        </>
      ) : book.uses ? (
        <p className="tc-silent">{book.note || 'Not judged yet.'}</p>
      ) : (
        <p className="tc-silent">Never uses “{term}” in its main text.</p>
      )}
    </article>
  );
}
