import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { loadIndex } from '../utils/data';

const CURATED_TEXT = [
  { bookId: 'ong-orality-and-literacy-the-technologizing', excerpt: '\u2018Reading\u2019 a text means converting it to sound, aloud or in the imagination, syllable-by-syllable in slow reading or sketchily in the rapid reading common to high-technology cultures.' },
  { bookId: 'ong-orality-and-literacy-the-technologizing', excerpt: 'a written text is basically unresponsive.' },
  { bookId: 'ong-orality-and-literacy-the-technologizing', excerpt: 'SOME DYNAMICS OF TEXTUALITY The condition of words in a text is quite different from their condition in spoken discourse.' },
  { bookId: 'ong-orality-and-literacy-the-technologizing', excerpt: 'The printed text is supposed to represent the words of an author in definitive or \u2018final\u2019 form.' },
  { bookId: 'ong-orality-and-literacy-the-technologizing', excerpt: 'every text is pretext' },
  { bookId: 'ong-orality-and-literacy-the-technologizing', excerpt: 'text is fundamentally pretext\u2014though this does not mean that text can be reduced to orality.' },
  { bookId: 'ong-orality-and-literacy-the-technologizing', excerpt: '\u2018The objectivity of the text is an illusion\u2019' },
  { bookId: 'ong-orality-and-literacy-the-technologizing', excerpt: 'Concrete poetry plays with the dialectic of the word locked into space as opposed to the sounded, oral word which can never be locked into space' },
  { bookId: 'jr-distributed-blackness-african-american-c', excerpt: 'the \u2018text is only experienced in an activity of production\u2019' },
  { bookId: 'haraway-simians-cyborgs-and-women-the-reinventio', excerpt: 'The most straightforward readings of any text are also situated arguments about fields of meanings and fields of power.' },
  { bookId: 'haraway-simians-cyborgs-and-women-the-reinventio', excerpt: 'Just as the world is originally fallen apart, the text is always already enmeshed in contending practices and hopes.' },
  { bookId: 'latour-reassembling-the-social-an-introduction', excerpt: 'A good text is never an unmediated portrait of what it describes.' },
  { bookId: 'latour-reassembling-the-social-an-introduction', excerpt: 'As if the absence of an absolute Text meant that all the texts were relative.' },
  { bookId: 'drucker-the-digital-humanities-coursebook-an-int', excerpt: 'Henceforth, the primary Text is effaced...all that remains is representation, unfolding in the verbal signs that manifest it, and hence becoming discourse.' },
  { bookId: 'drucker-the-digital-humanities-coursebook-an-int', excerpt: 'The representation of the text is not identical to its aesthetic structure.' },
  { bookId: 'losh-bodies-of-information', excerpt: 'the narrative features of a text are divorced from its content, including its circumstances of production and cultural location.' },
  { bookId: 'losh-bodies-of-information', excerpt: 'in theater the text is subject to the same laws and dislocations as the visual, audible, gestic and architectonic theatrical signs.' },
  { bookId: 'hayles-how-we-became-posthuman-virtual-bodies-i', excerpt: 'the body of the text is produced precisely by these fissures, which are not so much ruptures as productive dialectics' },
  { bookId: 'hayles-how-we-became-posthuman-virtual-bodies-i', excerpt: 'in electronic textuality, the possibilities for mutation within the text are enhanced and heightened by long coding chains.' },
];

const CURATED_TECHNOLOGY = [
  { bookId: 'vee-coding-literacy-how-computer-programming', excerpt: 'To push beyond thinking of technology in only instrumental ways, Heidegger claims we must see that \'the essence of technology is by no means anything technological.\'' },
  { bookId: 'vee-coding-literacy-how-computer-programming', excerpt: 'the essence of technology is in its \'way of revealing.\'' },
  { bookId: 'jr-distributed-blackness-african-american-c', excerpt: 'Dinerstein (2006) argues that \'technology is the American mythos\'' },
  { bookId: 'jr-distributed-blackness-african-american-c', excerpt: 'technology as an abstract concept functions as a white mythology and that technology is the unacknowledged source of European and Euro-American superiority within modernity' },
  { bookId: 'benjamin-race-after-technology', excerpt: 'technology is society, and society cannot be understood or represented without its technological tools.' },
  { bookId: 'costanzachock-design-justice-community-led-practices-t', excerpt: 'Technology is always a form of social knowledge, practices and products.' },
  { bookId: 'gold-debates-in-the-digital-humanities-2023', excerpt: 'Every piece of technology is an expression of cultural and social frameworks for understanding and engaging with the world.' },
  { bookId: 'steele-digital-black-feminism-critical-cultural', excerpt: 'Technology is central to the American experiment.' },
  { bookId: 'steele-digital-black-feminism-critical-cultural', excerpt: 'Black women have always engaged with technology; it is the definition of technology and technical expertise that shifted.' },
  { bookId: 'ong-orality-and-literacy-the-technologizing', excerpt: 'the new technology is not merely used to convey the critique: in fact, it brought the critique into existence.' },
  { bookId: 'mullaney-your-computer-is-on-fire', excerpt: 'Philosophers have long bristled at the fact that technology is often understood only instrumentally\u2014by its use value.' },
  { bookId: 'benjamin-race-after-technology', excerpt: 'technology is often depicted as neutral, or as a blank slate developed outside political and social contexts' },
  { bookId: 'benjamin-race-after-technology', excerpt: 'the view that \'technology is a neutral tool\' ignores how race also functions like a tool' },
  { bookId: 'costanzachock-design-justice-community-led-practices-t', excerpt: 'technology is primarily used to extend capitalist patriarchal modernity and the aims of the market and/or the state' },
  { bookId: 'steele-digital-black-feminism-critical-cultural', excerpt: 'Western technology was created for and alongside systemic oppression' },
  { bookId: 'steele-digital-black-feminism-critical-cultural', excerpt: 'Black women\u2019s relationship to labor and technology is a story of using tools and technologies crafted to oppress as mechanisms of resistance.' },
  { bookId: 'steele-digital-black-feminism-critical-cultural', excerpt: 'The emergent definition of technology systematically removed Black women\u2019s labor and communication patterns.' },
  { bookId: 'steele-digital-black-feminism-critical-cultural', excerpt: 'those in power defined technology' },
  { bookId: 'mullaney-your-computer-is-on-fire', excerpt: 'Technology Is People\u2019s Labor' },
  { bookId: 'mullaney-your-computer-is-on-fire', excerpt: 'High technology is often a screen for propping up idealistic progress narratives while simultaneously torpedoing meaningful social reform' },
  { bookId: 'losh-bodies-of-information', excerpt: 'As an isolated object, technology is of little interest.' },
  { bookId: 'gold-debates-in-the-digital-humanities-2023', excerpt: 'the question of race and technology is not just about what race is but what relations and questions engender race.' },
  { bookId: 'benjamin-race-after-technology', excerpt: 'technology is being used to expand the carceral state, allowing policing and imprisonment to stand in for civil society while seemingly neutral algorithms justify that shift' },
  { bookId: 'costanzachock-design-justice-community-led-practices-t', excerpt: 'Community needs and priorities must drive technology design and development, and technology is most useful when priorities are set by those who are not technologists.' },
];

const THREADS = [
  {
    id: 'text',
    title: 'What counts as a "text"?',
    terms: ['text'],
    curated: CURATED_TEXT,
  },
  {
    id: 'technology',
    title: 'What counts as "technology"?',
    terms: ['technology'],
    curated: CURATED_TECHNOLOGY,
  },
  {
    id: 'race-algorithms',
    title: 'Race, algorithms, and data',
    terms: ['race', 'algorithms', 'datafication'],
  },
  {
    id: 'feminist-tech',
    title: 'Feminist approaches to tech',
    terms: ['feminist', 'embodiment', 'design justice'],
  },
  {
    id: 'classification',
    title: 'Classification and categories',
    terms: ['classification', 'categorization', 'normativity'],
  },
  {
    id: 'surveillance',
    title: 'Surveillance and visibility',
    terms: ['surveillance', 'visibility'],
  },
  {
    id: 'embodiment',
    title: 'Bodies, embodiment, and data',
    terms: ['embodiment', 'health', 'biopolitics'],
  },
  {
    id: 'literacy',
    title: 'Literacy, coding, and access',
    terms: ['coding literacy', 'rhetoric'],
  },
  {
    id: 'archives',
    title: 'Archives, erasure, and memory',
    terms: ['erasure', 'transparency'],
  },
];

export default function ThematicThreads() {
  const [index, setIndex] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    loadIndex().then(setIndex);
  }, []);

  if (!index) return <div className="loading">Loading...</div>;

  const selectedThread = THREADS.find(t => t.id === selectedId);

  const bookLookup = {};
  for (const book of index.books) {
    bookLookup[book.id] = book;
  }

  // Collect passages for the selected thread
  let passages = [];
  if (selectedThread) {
    if (selectedThread.curated) {
      // Use curated quotes — group by bookId
      const groups = {};
      for (const q of selectedThread.curated) {
        if (!groups[q.bookId]) {
          const book = bookLookup[q.bookId];
          groups[q.bookId] = {
            id: q.bookId,
            title: book ? book.title : q.bookId,
            author: book ? (book.author || []).join(', ') : '',
            year: book ? book.year : null,
            passages: [],
          };
        }
        groups[q.bookId].passages.push({ excerpt: q.excerpt, matchedTerm: 'technology' });
      }
      passages = Object.values(groups).sort((a, b) => a.author.localeCompare(b.author));
    } else {
      // Pull from definitions data
      const bookPassages = {};
      for (const book of index.books) {
        const defs = book.definitions || {};
        const matching = [];
        for (const term of selectedThread.terms) {
          if (defs[term]) {
            for (const d of defs[term]) {
              matching.push({ ...d, matchedTerm: term });
            }
          }
        }
        if (matching.length > 0) {
          const seen = new Set();
          const unique = matching.filter(m => {
            const k = m.excerpt.slice(0, 80);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
          bookPassages[book.id] = {
            id: book.id,
            title: book.title,
            author: (book.author || []).join(', '),
            year: book.year,
            passages: unique,
          };
        }
      }
      passages = Object.values(bookPassages).sort((a, b) => a.author.localeCompare(b.author));
    }
  }

  // Count passages per thread for the sidebar
  const threadCounts = {};
  for (const thread of THREADS) {
    if (thread.curated) {
      threadCounts[thread.id] = thread.curated.length;
    } else {
      let count = 0;
      for (const book of index.books) {
        const defs = book.definitions || {};
        for (const term of thread.terms) {
          count += (defs[term] || []).length;
        }
      }
      threadCounts[thread.id] = count;
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Thematic Threads</h1>
        <p>What do the authors say about each theme? Go to the thread, not 30 books.</p>
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {/* Thread list */}
        <div style={{ width: '300px', flexShrink: 0 }}>
          <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Threads
          </h3>
          {THREADS.map(thread => (
            <button
              key={thread.id}
              onClick={() => setSelectedId(thread.id)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '0.6rem 0.75rem',
                border: 'none',
                background: selectedId === thread.id ? 'var(--white)' : 'transparent',
                color: selectedId === thread.id ? 'var(--forest, var(--text-primary))' : 'var(--text-secondary)',
                fontWeight: selectedId === thread.id ? 700 : 400,
                fontFamily: 'var(--font-heading)',
                fontSize: '1.15rem',
                borderRadius: '4px',
                borderLeft: selectedId === thread.id ? '3px solid var(--coral, #3f7fc4)' : '3px solid transparent',
                cursor: 'pointer',
                marginBottom: '0.25rem',
              }}
            >
              {thread.title}
              <span style={{
                display: 'block', fontSize: '0.85rem', fontWeight: 400,
                color: 'var(--text-muted)', fontFamily: 'var(--font-body)',
                marginTop: '0.1rem',
              }}>
                {threadCounts[thread.id]} passages
              </span>
            </button>
          ))}
        </div>

        {/* Thread content */}
        <div style={{ flex: 1, minWidth: '300px' }}>
          {selectedThread ? (
            <div>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem', fontFamily: 'var(--font-heading)' }}>
                {selectedThread.title}
              </h2>
              <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                {passages.length} book{passages.length !== 1 ? 's' : ''} with relevant passages
                {' \u2022 '} Terms: {selectedThread.terms.join(', ')}
              </p>

              {passages.map(bookGroup => (
                <div key={bookGroup.id} className="card" style={{ marginBottom: '1.25rem' }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <Link to={`/book/${bookGroup.id}`} style={{
                      fontFamily: 'var(--font-heading)', fontWeight: 700,
                      fontSize: '1.2rem',
                    }}>
                      {bookGroup.title}
                    </Link>
                    <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
                      {bookGroup.author} ({bookGroup.year || 'n.d.'})
                    </p>
                  </div>

                  {bookGroup.passages.map((p, i) => (
                    <div key={i} style={{
                      marginBottom: '0.75rem',
                      paddingLeft: '1rem',
                      borderLeft: '3px solid var(--coral, #3f7fc4)',
                    }}>
                      {p.locator_type && (
                        <span style={{
                          fontSize: '0.85rem', color: 'var(--text-muted)',
                          display: 'block', marginBottom: '0.25rem',
                        }}>
                          {p.locator_type} {p.locator} \u2022 matched: {p.matchedTerm}
                        </span>
                      )}
                      <p style={{
                        fontSize: '1rem', fontStyle: 'italic',
                        color: 'var(--text-secondary)', lineHeight: 1.7,
                      }}>
                        "{highlightTerms(p.excerpt.slice(0, 500), selectedThread.terms)}{p.excerpt.length > 500 ? '...' : ''}"
                      </p>
                    </div>
                  ))}
                </div>
              ))}

              {passages.length === 0 && (
                <div className="empty-state">
                  <p>No passages found for this thread in the extracted definitions.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <p>Select a thread from the list to see what each author says about that theme.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function highlightTerms(text, terms) {
  if (!terms || terms.length === 0) return text;
  const pattern = terms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const regex = new RegExp(`(${pattern})`, 'gi');
  const segments = text.split(regex);
  return segments.map((seg, i) =>
    regex.test(seg)
      ? <mark key={i} style={{ background: 'rgba(63, 127, 196, 0.25)', padding: '0.05rem 0.15rem', borderRadius: '2px' }}>{seg}</mark>
      : seg
  );
}
