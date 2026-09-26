import { Link } from 'react-router-dom';
import { readerLink } from '../utils/links';

// The three kinds of information the study tabs show, kept visibly apart:
//   <Quote>         words printed in a book (solid rule, serif)
//   <ClaudeReading> Claude's judgment (dashed box) until you check it
//   ...and once you mark a judgment checked, its box turns solid green.

export function Quote({ text, bookId, locator, page, size = 'normal' }) {
  return (
    <figure className={`ev-quote ev-quote-${size}`}>
      <figcaption className="ev-label">From the text</figcaption>
      <blockquote>“{text}”</blockquote>
      <Link className="ev-page-link" to={readerLink(bookId, locator, text)}>
        Open at {page} <span aria-hidden="true">→</span>
      </Link>
    </figure>
  );
}

export function ClaudeReading({ id, reviews, children }) {
  const status = reviews.statusOf(id);
  const label = status === 'checked' ? '✓ You checked this'
    : status === 'flagged' ? '⚑ You flagged this' : '✦ Claude’s reading';
  return (
    <section className={`ev-claude ev-${status || 'unchecked'}`} aria-label={label}>
      <div className="ev-claude-head">
        <span className="ev-label">{label}</span>
        <div className="ev-actions">
          {status ? (
            <button className="ev-btn" onClick={() => reviews.setStatus(id, null)}>Undo</button>
          ) : (
            <>
              <button className="ev-btn ev-btn-ok" onClick={() => reviews.setStatus(id, 'checked')}>
                Looks right
              </button>
              <button className="ev-btn ev-btn-flag" onClick={() => reviews.setStatus(id, 'flagged')}>
                Flag
              </button>
            </>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

export function ExportChecks({ reviews, tab }) {
  const n = (reviews.counts.checked || 0) + (reviews.counts.flagged || 0);
  return (
    <button
      className={`ev-btn ev-export ${n ? 'has-checks' : ''}`}
      onClick={reviews.exportFile}
      title={`Download ${tab}.json to commit as data/reviews/${tab}.json`}
    >
      Export my checks ({n})
    </button>
  );
}
