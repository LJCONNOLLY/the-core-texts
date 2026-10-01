import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadTalkingEssay } from '../utils/data';

// "How the Core Texts Use Each Other": LJ's own analysis, laid out as written.
// The words come unchanged from data/talking-essay.json; this only arranges them.

const PERIOD_TONE = {
  p1966: 'indigo',
  p2001: 'teal',
  p2018: 'amber',
  p2020: 'rose',
  p2021: 'green',
};

const ROLE_TONE = { Foucault: 'indigo', Haraway: 'teal', Noble: 'amber' };

// "1966 to 1999: Ong, Haraway, Hayles, Latour" -> "1966 to 1999" for the jump links
const shortTitle = t => t.split(':')[0];

export default function TalkingEssay({ onShowPassages }) {
  const [essay, setEssay] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTalkingEssay().then(setEssay).catch(e => setError(e.message));
  }, []);

  if (error) return <div className="empty-state"><p>Could not load the analysis: {error}</p></div>;
  if (!essay) return <div className="loading">Loading…</div>;

  const [relies, overview, ...periods] = essay.sections;
  const jump = id => document.getElementById(`es-${id}`)?.scrollIntoView({ block: 'start' });

  return (
    <article className="es">
      <header className="es-head">
        <span className="es-badge">Your analysis</span>
        <h2>{essay.title}</h2>
        <p className="es-byline">{essay.byline}</p>
      </header>

      <nav className="es-jump" aria-label="Sections">
        {essay.sections.map(s => (
          <button
            key={s.id}
            className={`es-jump-btn tone-${PERIOD_TONE[s.id] || 'blue'}`}
            onClick={() => jump(s.id)}
          >
            {shortTitle(s.title)}
          </button>
        ))}
      </nav>

      <Relies section={relies} />
      <Overview section={overview} />
      {periods.map(p => (
        <Period key={p.id} section={p} tone={PERIOD_TONE[p.id]} onShowPassages={onShowPassages} />
      ))}
    </article>
  );
}

function SectionTitle({ section, tone = 'blue' }) {
  return (
    <h3 id={`es-${section.id}`} className={`es-section-title tone-${tone}`}>
      {section.title}
    </h3>
  );
}

function Relies({ section }) {
  const [, , cPassages, cLeans, cHow] = section.columns;
  const max = Math.max(...section.rows.map(r => r.passages));
  return (
    <section className="es-section">
      <SectionTitle section={section} />
      {section.intro.map((p, i) => <p key={i} className="es-lead tone-blue">{p}</p>)}

      <ol className="es-ranks">
        {section.rows.map(r => (
          <li key={r.rank} className="es-rank">
            <span className="es-rank-num" aria-label={`${section.columns[0]} ${r.rank}`}>{r.rank}</span>
            <div className="es-rank-body">
              <Link to={`/book/${r.bookId}`} className="es-rank-book">{r.book}</Link>
              <div className="es-rank-meta">
                <span className="es-meter" aria-hidden="true">
                  <span style={{ width: `${(r.passages / max) * 100}%` }} />
                </span>
                <span className="es-rank-count">
                  <b>{r.passages}</b> <span>{cPassages}</span>
                </span>
              </div>
              <p className="es-rank-leans"><span className="es-k">{cLeans}</span> {r.leansOn}</p>
              <p className="es-rank-how"><span className="es-k">{cHow}</span> {r.how}</p>
            </div>
          </li>
        ))}
      </ol>

      {section.after.map((p, i) => <p key={i} className="es-aside">{p}</p>)}
    </section>
  );
}

function Overview({ section }) {
  const max = Math.max(...section.chart.rows.map(r => r.count));
  return (
    <section className="es-section">
      <SectionTitle section={section} />
      {section.intro.map((p, i) => <p key={i} className="es-lead tone-blue">{p}</p>)}

      <div className="es-roles">
        {section.roles.map(r => (
          <div key={r.who} className={`es-role tone-${ROLE_TONE[r.who]}`}>
            <h4>{r.who}</h4>
            <p>{r.text}</p>
          </div>
        ))}
      </div>

      <p className="es-aside">{section.clusters}</p>

      <figure className="es-chart">
        <figcaption>
          <b>{section.chart.title}</b>
          <span>{section.chart.unit}</span>
        </figcaption>
        {section.chart.rows.map(r => (
          <div key={r.name} className="es-bar">
            <span className="es-bar-name">{r.name}</span>
            <span className="es-bar-track" aria-hidden="true">
              <span style={{ width: `${(r.count / max) * 100}%` }} />
            </span>
            <span className="es-bar-count">{r.count}</span>
          </div>
        ))}
      </figure>

      <p className="es-note">{section.note}</p>
    </section>
  );
}

function Period({ section, tone, onShowPassages }) {
  return (
    <section className={`es-section es-period tone-${tone}`}>
      <SectionTitle section={section} tone={tone} />
      <p className={`es-lead tone-${tone}`}>{section.intro}</p>

      {section.books.map(b => (
        <div key={b.label} className={`es-book tone-${tone}`}>
          <h4 className="es-book-title">
            <Link to={`/book/${b.bookId}`}>{b.label}</Link>
          </h4>
          <p className="es-book-text">{b.text}</p>
          {b.argument && <p className={`es-argument tone-${tone}`}>{b.argument}</p>}
          <div className="es-book-links">
            <button className="es-link-btn" onClick={() => onShowPassages(b.bookId)}>
              See every passage <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}
