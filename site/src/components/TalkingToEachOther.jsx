import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { loadIndex, loadTalking } from '../utils/data';
import { highlightText } from '../utils/text';

const FILTERS = [
  { id: 'all', label: 'Everywhere' },
  { id: 'body', label: 'In the text' },
  { id: 'notes', label: 'In the notes' },
];

const MODES = [
  { id: 'book', label: 'Who each book talks to' },
  { id: 'author', label: 'Who talks about each author' },
];

const shortTitle = title => title.replace(/\s*\(.*\)$/, '');

export default function TalkingToEachOther() {
  const [index, setIndex] = useState(null);
  const [talking, setTalking] = useState(null);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState('book');
  const [sourceId, setSourceId] = useState(null);
  const [authorName, setAuthorName] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    Promise.all([loadIndex(), loadTalking()])
      .then(([idx, t]) => {
        setIndex(idx);
        setTalking(t);
        setSourceId(Object.keys(t.sources)[0] || null);
      })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <div className="empty-state"><p>Could not load cross-references: {error}</p></div>;
  if (!index || !talking) return <div className="loading">Loading...</div>;

  const bookLookup = {};
  for (const book of index.books) bookLookup[book.id] = book;
  const titleOf = id => shortTitle(bookLookup[id]?.title || talking.sources[id]?.title || id);

  const keep = m => filter === 'all' || (filter === 'notes' ? m.in_notes : !m.in_notes);

  // Every mention, tagged with the book it appears in
  const all = [];
  for (const [id, src] of Object.entries(talking.sources)) {
    for (const m of src.mentions) all.push({ ...m, sourceId: id });
  }

  // Authors who are talked about, most-mentioned first
  const authorCounts = {};
  for (const m of all) {
    if (!authorCounts[m.author]) authorCounts[m.author] = { name: m.author, bookId: m.bookId, count: 0, books: new Set() };
    authorCounts[m.author].count += 1;
    authorCounts[m.author].books.add(m.sourceId);
  }
  const authors = Object.values(authorCounts).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const selectedAuthor = authorName || authors[0]?.name;

  let heading, subheading, groups, total, emptyText, sideItems;
  if (mode === 'book') {
    const source = talking.sources[sourceId];
    const mentions = all.filter(m => m.sourceId === sourceId && keep(m));
    groups = groupBy(mentions, m => m.author, m => ({
      key: m.author,
      title: m.author,
      subtitle: bookLookup[m.bookId]?.title,
      subtitleLink: `/book/${m.bookId}`,
    }));
    heading = `Who ${titleOf(sourceId)} talks to`;
    subheading = `${groups.length} core author${groups.length !== 1 ? 's' : ''}`;
    total = mentions.length;
    emptyText = source?.mentions.length
      ? 'No mentions with this filter.'
      : 'This book doesn’t name any other author on the core list.';
    sideItems = Object.entries(talking.sources).map(([id, src]) => ({
      id,
      title: titleOf(id),
      detail: `${src.authors.join(' & ')} • ${src.mentions.length} mentions`,
      selected: id === sourceId,
      onClick: () => setSourceId(id),
    }));
  } else {
    const mentions = all.filter(m => m.author === selectedAuthor && keep(m));
    groups = groupBy(mentions, m => m.sourceId, m => ({
      key: m.sourceId,
      title: titleOf(m.sourceId),
      titleLink: `/book/${m.sourceId}`,
      subtitle: talking.sources[m.sourceId].authors.join(' & '),
    }));
    heading = `Who talks about ${selectedAuthor}`;
    subheading = `${groups.length} book${groups.length !== 1 ? 's' : ''}`;
    total = mentions.length;
    emptyText = 'No mentions with this filter.';
    sideItems = authors.map(a => ({
      id: a.name,
      title: a.name,
      detail: `${a.books.size} book${a.books.size !== 1 ? 's' : ''} • ${a.count} mentions`,
      selected: a.name === selectedAuthor,
      onClick: () => setAuthorName(a.name),
    }));
  }

  return (
    <div>
      <div className="page-header">
        <h1>Talking to Each Other</h1>
        <p>Every place a book names another author on the core list, with the sentence before and after.</p>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {MODES.map(m => (
          <button
            key={m.id}
            className={`btn ${mode === m.id ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div style={{ width: '300px', flexShrink: 0, maxHeight: '80vh', overflowY: 'auto' }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {mode === 'book' ? 'Books' : 'Authors'}
          </h3>
          {sideItems.map(item => (
            <button
              key={item.id}
              onClick={item.onClick}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.6rem 0.75rem',
                border: 'none',
                background: item.selected ? 'var(--white)' : 'transparent',
                color: item.selected ? 'var(--forest)' : 'var(--text-secondary)',
                fontWeight: item.selected ? 700 : 400,
                fontFamily: 'var(--font-heading)',
                fontSize: '1.15rem',
                borderRadius: '4px',
                borderLeft: item.selected ? '3px solid var(--coral)' : '3px solid transparent',
                cursor: 'pointer',
                marginBottom: '0.25rem',
              }}
            >
              {item.title}
              <span style={{
                display: 'block', fontSize: '0.85rem', fontWeight: 400,
                color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
                marginTop: '0.1rem',
              }}>
                {item.detail}
              </span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: '300px' }}>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>
            {heading}
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            {subheading} {'•'} {total} mention{total !== 1 ? 's' : ''}
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button
                key={f.id}
                className={`btn ${filter === f.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {groups.map(group => (
            <div key={group.key} className="card" style={{ marginBottom: '1.25rem' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.3rem' }}>
                  {group.titleLink ? <Link to={group.titleLink}>{group.title}</Link> : group.title}
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                    {group.mentions.length} mention{group.mentions.length !== 1 ? 's' : ''}
                  </span>
                </h3>
                {group.subtitle && (group.subtitleLink
                  ? <Link to={group.subtitleLink} style={{ fontSize: '1rem' }}>{group.subtitle}</Link>
                  : <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{group.subtitle}</p>)}
              </div>

              <ol style={{ paddingLeft: '1.25rem' }}>
                {group.mentions.map((m, i) => <Mention key={i} m={m} />)}
              </ol>
            </div>
          ))}

          {groups.length === 0 && (
            <div className="empty-state">
              <p>{emptyText}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Group mentions by key, largest group first
function groupBy(mentions, keyOf, describe) {
  const groups = {};
  for (const m of mentions) {
    const k = keyOf(m);
    if (!groups[k]) groups[k] = { ...describe(m), mentions: [] };
    groups[k].mentions.push(m);
  }
  return Object.values(groups).sort((a, b) =>
    b.mentions.length - a.mentions.length || a.title.localeCompare(b.title)
  );
}

function Mention({ m }) {
  return (
    <li style={{ marginBottom: '1rem', paddingLeft: '0.25rem' }}>
      <Link
        to={`/book/${m.sourceId}?locator=${m.locator}`}
        style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}
      >
        {m.in_notes
          ? <><span className="tag tag-gold">In the notes</span> {[m.section, m.note && `note ${m.note}`, m.page].filter(Boolean).join(', ')}</>
          : [m.section, m.page].filter(Boolean).join(' \u2022 ')}
      </Link>
      <p style={{ fontSize: '1rem', lineHeight: 1.7, color: 'var(--text-secondary)', borderLeft: '3px solid var(--coral)', paddingLeft: '1rem' }}>
        {m.before && <span style={{ color: 'var(--text-muted)' }}>{m.before} </span>}
        <span style={{ color: 'var(--text-primary)' }}>{highlightText(m.sentence, m.highlights)}</span>
        {m.after && <span style={{ color: 'var(--text-muted)' }}> {m.after}</span>}
      </p>
    </li>
  );
}
