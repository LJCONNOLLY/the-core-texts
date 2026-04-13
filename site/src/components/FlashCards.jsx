import { useState, useEffect, useCallback } from 'react';
import { loadIndex } from '../utils/data';

const FLASHCARD_DATA = {
  'jackson-hashtagactivism-networks-of-race-and-gen': {
    summary: 'Argues that hashtag activism on Twitter is a legitimate and effective form of political organizing, particularly for Black women and other marginalized groups. Examines how movements like #BlackLivesMatter and #MeToo challenge mainstream media narratives and create counterpublics online.',
    coinages: ['Networked counterpublics — extends Fraser\'s counterpublic theory into social media contexts'],
  },
  'noble-algorithms-of-oppression': {
    summary: 'Argues that search engines like Google are not neutral information retrieval systems but reproduce racism and sexism through their algorithms. Shows how searches for Black women return dehumanizing results, demonstrating that algorithmic bias is structural, not accidental.',
    coinages: ['Algorithmic oppression — the specific harm produced when biased algorithms operate at scale on marginalized populations', 'Technological redlining — digital exclusion mapped onto histories of spatial racial exclusion'],
  },
  'eubanks-automating-inequality-how-high-tech-tool': {
    summary: 'Argues that automated decision-making systems in welfare, child protective services, and public housing disproportionately harm poor and working-class communities. Shows that these systems don\'t create new inequalities but digitize and accelerate existing ones.',
    coinages: ['Digital poorhouse — the network of automated systems that surveils and controls poor communities, echoing the 19th century poorhouse'],
  },
  'losh-bodies-of-information': {
    summary: 'A collection arguing that digital humanities must take embodiment seriously — that data is never disembodied, and that feminist methods are essential for understanding how bodies, identity, and power operate in digital spaces.',
    coinages: ['Bodily infrastructure — the way bodies themselves function as data infrastructure, subject to collection, classification, and control'],
  },
  'vee-coding-literacy-how-computer-programming': {
    summary: 'Argues that coding should be understood as a form of literacy with a long historical precedent, not a purely technical skill. Examines the cultural and political stakes of who gets access to coding education and whose knowledge counts.',
    coinages: ['Coding literacy — reframes programming not as a technical skill but as a literacy practice with social, cultural, and political dimensions'],
  },
  'manovich-cultural-analytics': {
    summary: 'Argues for using computational methods and data visualization to study culture at scale. Develops a framework for analyzing large cultural datasets — images, films, texts — to find patterns invisible to traditional humanistic reading.',
    coinages: ['Cultural analytics — the use of quantitative data analysis and visualization to study culture at scale', 'Media visualization — visualizing entire media collections as images rather than reading them individually'],
  },
  'dignazio-data-feminism-strong-ideas': {
    summary: 'Argues that data science is not neutral and that feminist principles — examining power, embracing embodiment, valuing lived experience — should guide how data is collected, analyzed, and visualized.',
    coinages: ['Data visceralization — making data felt in the body, not just seen; extends data visualization toward embodied experience'],
  },
  'gold-debates-in-the-digital-humanities-2023': {
    summary: 'A collection capturing the current state of the field — debates about what digital humanities is, who it includes, and where it is going. Covers infrastructure, labor, race, and the tension between technical and humanistic methods.',
    coinages: ['Minimal computing — doing digital work with minimal technological resources, particularly relevant for Global South scholars'],
  },
  'costanzachock-design-justice-community-led-practices-t': {
    summary: 'Argues that design reproduces inequality when it centers the needs of the most privileged users. Proposes a design justice framework that centers marginalized communities as leaders and beneficiaries of design processes.',
    coinages: ['Design justice — a framework and social movement that centers those normally excluded from and harmed by design', 'Design site — any location where design practices occur, broadly defined'],
  },
  'tham-design-thinking-in-technical-communicati': {
    summary: 'Argues for integrating design thinking methodology into technical communication pedagogy and practice. Focuses on problem-solving, user-centered design, and how technical communicators can adapt design frameworks to their work.',
    coinages: ['Applies design thinking specifically to TPC contexts rather than product design'],
  },
  'gonzales-designing-multilingual-experiences-in-te': {
    summary: 'Argues that technical communication must account for multilingual users and that language diversity is a resource rather than a problem. Examines how design can either exclude or center speakers of languages other than English.',
    coinages: ['Language brokering — the labor multilingual people perform to navigate and translate between languages in institutional contexts, often invisible and uncompensated'],
  },
  'steele-digital-black-feminism-critical-cultural': {
    summary: 'Argues that Black women have developed distinct digital cultures and practices of resistance online, and that studying these requires a Black feminist framework. Examines blogs, social media, and digital media production by Black women.',
    coinages: ['Pleasure politics — centering joy, pleasure, and desire as sites of Black feminist resistance, not just critique and survival'],
  },
  'nakamura-digitizing-race-visual-cultures-of-the-i': {
    summary: 'Argues that the internet is not a post-racial space but one where racial identity is performed, consumed, and commodified. Examines visual culture online — avatars, images, interfaces — as sites where race is produced and contested.',
    coinages: ['Cybertypes — the specific stereotyped racial representations that circulate in digital media', 'Identity tourism — adopting racial or cultural identities online as a form of play that reinforces rather than challenges racial hierarchies'],
  },
  'jr-distributed-blackness-african-american-c': {
    summary: 'Argues that Black users have developed a distinctive critical technocultural discourse — a way of using and interpreting technology shaped by Black culture and experience. Develops Critical Race Theory in Technology as a framework.',
    coinages: ['Critical technocultural discourse analysis (CTDA) — Brock\'s own method for analyzing how race shapes technology use and meaning-making', 'Distributed Blackness — the way Black culture and identity circulate and accumulate across digital networks'],
  },
  'hayles-how-we-became-posthuman-virtual-bodies-i': {
    summary: 'Argues that the concept of the posthuman — the idea that human identity can be separated from the body and uploaded or replicated — has a history rooted in cybernetics. Examines how information came to be understood as separable from its material substrate.',
    coinages: ['Flickering signifier — extends Saussure\'s floating signifier into the digital context, where meaning is unstable and context-dependent', 'Embodied virtuality — the insistence that even virtual experience is grounded in embodied, material reality'],
  },
  'mckinney-information-activism-a-queer-history-of': {
    summary: 'Argues that lesbian feminist organizations developed sophisticated information infrastructures — archives, databases, newsletters — as a form of political activism. Examines the queer history of information technology outside mainstream narratives.',
    coinages: ['Information activism — the use of information systems and practices as a primary form of political resistance and community building'],
  },
  'gray-intersectional-tech-black-users-in-digit': {
    summary: 'Argues that digital gaming spaces reproduce and intensify racism, sexism, and homophobia, and that Black and other marginalized gamers develop resistant practices in response.',
    coinages: ['Intersectional tech — the framework for understanding how technology reproduces multiple overlapping systems of oppression simultaneously'],
  },
  'bailey-misogynoir-transformed-black-womens-digi': {
    summary: 'Argues that Black women online have transformed misogynoir — the specific racism and sexism directed at them — into sites of resistance, creativity, and community. Examines digital media production by Black women as political and cultural practice.',
    coinages: ['Misogynoir — the specific intersection of anti-Black racism and misogyny directed at Black women', 'Digital alchemy — the transformation of racist and sexist digital attacks into creative and political resources'],
  },
  'risam-new-digital-worlds-postcolonial-digital': {
    summary: 'Argues that digital humanities must engage with postcolonial theory and center non-Western knowledge traditions. Examines how the digital humanities reproduces colonial hierarchies of knowledge.',
    coinages: ['Postcolonial DH — the explicit application of postcolonial critique to digital humanities methods and institutions'],
  },
  'ong-orality-and-literacy-the-technologizing': {
    summary: 'Argues that the shift from oral to literate culture fundamentally restructured human consciousness, thought, and social organization. A foundational text for understanding how communication technologies shape cognition.',
    coinages: ['Secondary orality — the new orality produced by electronic media shaped by literacy', 'Technologizing of the word — writing as a technology that transforms the word from a living event into a thing'],
  },
  'foucault-order-of-things-an-archaeology-of-human': {
    summary: 'Argues that every historical period has an underlying episteme — an invisible structure of knowledge that determines what can be thought and said. Examines how the human sciences emerged as a particular way of classifying and knowing human beings.',
    coinages: ['Episteme — the underlying structure of knowledge in a historical period, deeper than individual disciplines or theories', 'Archaeology — Foucault\'s method for excavating the conditions of possibility for knowledge'],
  },
  'benjamin-race-after-technology': {
    summary: 'Argues that new technologies are not post-racial but encode and reproduce racism in new forms — what she calls the "New Jim Code." Examines facial recognition, algorithms, and digital platforms as sites of racial discrimination dressed up as objectivity.',
    coinages: ['New Jim Code — the use of new technologies to reinscribe anti-Black racism in forms that appear neutral or objective', 'Abolitionist toolkit — a set of conceptual tools for dismantling racist technologies'],
  },
  'latour-reassembling-the-social-an-introduction': {
    summary: 'Argues against the idea that "society" is a pre-existing context that explains things. Instead, the social is something that must be traced and assembled — Actor-Network Theory maps the connections between human and nonhuman actors.',
    coinages: ['Actant — any human or nonhuman entity that acts and makes a difference in a network', 'Mediator vs. intermediary — a mediator transforms meaning while an intermediary merely transports it', 'Matters of concern vs. matters of fact'],
  },
  'haraway-simians-cyborgs-and-women-the-reinventio': {
    summary: 'A collection including the foundational "Cyborg Manifesto" and "Situated Knowledges." Argues against pure boundaries between human and machine, nature and culture. Develops situated knowledge as an alternative to claims of objectivity.',
    coinages: ['Situated knowledge — all knowledge is partial, embodied, and located', 'God trick — the false claim to a disembodied objective perspective', 'Cyborg — a figure for the breakdown of boundaries between human and machine as political possibility'],
  },
  'walton-technical-communication-after-the-social': {
    summary: 'Argues that technical communication must take social justice seriously as a central concern, not an add-on. Develops the 3Ps framework (positionality, privilege, power) for analyzing how communication practices include or exclude.',
    coinages: ['The 3Ps framework — positionality, privilege, and power as the three lenses through which technical communicators must analyze their work'],
  },
  'drucker-the-digital-humanities-coursebook-an-int': {
    summary: 'Argues that digital humanities requires both technical skills and humanistic critical frameworks. Provides an introduction to the field\'s methods with attention to the interpretive and political dimensions of each.',
    coinages: ['Capta — data understood as taken and constructed rather than given', 'Graphesis — the visual and graphic dimensions of knowledge production'],
  },
  'chun-updating-to-remain-the-same-habitual-new': {
    summary: 'Argues that digital media operates through habits — repeated patterns of use that feel natural but are produced and maintained by platforms. Examines how software updates and network infrastructure shape user behavior.',
    coinages: ['Enduring ephemeral — the paradox of digital media that feels permanent but is constantly updated', 'Update to remain the same — the logic by which platforms maintain control through the appearance of change'],
  },
  'rose-visual-methodologies-an-introduction-to': {
    summary: 'Argues that visual materials require specific research methods and critical frameworks. Provides a comprehensive overview of approaches for studying images, with attention to power and representation.',
    coinages: ['Sites of the image — Rose\'s framework organizing analysis around three sites: production, the image itself, and audiencing'],
  },
  'ahmed-whats-the-use-on-the-uses-of-use': {
    summary: 'Argues that use is never neutral — that objects, concepts, and bodies get worn into particular paths of use that reinforce existing social arrangements. Examines use as a political and phenomenological concept.',
    coinages: ['Grooves of use — the paths worn into objects and practices by repeated use', 'Being used up — the experience of bodies worn down by the demands placed on them'],
  },
  'mullaney-your-computer-is-on-fire': {
    summary: 'A collection arguing that digital technology is not neutral, inevitable, or universal but shaped by specific histories of power, labor, and exclusion. Essays examine race, gender, colonialism, and infrastructure as constitutive of computing.',
    coinages: ['The title itself is a provocation — computing is not a cool neutral system but a burning political problem'],
  },
};

export default function FlashCards() {
  const [index, setIndex] = useState(null);
  const [deck, setDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    loadIndex().then(idx => {
      setIndex(idx);
      const ids = idx.books.map(b => b.id).filter(id => FLASHCARD_DATA[id]);
      setDeck(ids);
    });
  }, []);

  const currentBookId = deck[currentIndex];
  const book = index?.books.find(b => b.id === currentBookId);
  const data = currentBookId ? FLASHCARD_DATA[currentBookId] : null;

  const goNext = useCallback(() => {
    setFlipped(false);
    setTimeout(() => setCurrentIndex(i => Math.min(deck.length - 1, i + 1)), 150);
  }, [deck.length]);

  const goPrev = useCallback(() => {
    setFlipped(false);
    setTimeout(() => setCurrentIndex(i => Math.max(0, i - 1)), 150);
  }, []);

  const shuffle = useCallback(() => {
    setFlipped(false);
    setCurrentIndex(0);
    setDeck(d => {
      const shuffled = [...d];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
  }, []);

  if (!index || deck.length === 0) return <div className="loading">Loading flash cards...</div>;

  const base = import.meta.env.BASE_URL;

  return (
    <div>
      <div className="page-header">
        <h1>Flash Cards</h1>
        <p>Quiz yourself on the {deck.length} books in the archive</p>
      </div>

      {/* Card */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
        <div
          onClick={() => setFlipped(f => !f)}
          style={{
            width: '420px', height: '540px',
            perspective: '1200px',
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: '100%', height: '100%',
            position: 'relative',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s ease',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}>
            {/* Front */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              background: '#e8dcc8',
              borderRadius: '14px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '2rem',
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            }}>
              <CoverImage bookId={currentBookId} base={base} />
              <h2 style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '24px', textAlign: 'center',
                color: '#907040', marginTop: '1.5rem',
                lineHeight: 1.3,
              }}>
                {book?.title}
              </h2>
            </div>

            {/* Back */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              background: '#f5f0e8',
              borderRadius: '14px',
              padding: '2rem',
              boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
              overflowY: 'auto',
              display: 'flex', flexDirection: 'column',
            }}>
              <p style={{
                fontFamily: 'var(--font-heading)',
                fontSize: '20px', color: '#907040',
                marginBottom: '0.5rem', fontWeight: 700,
              }}>
                {(book?.author || []).join(', ')} ({book?.year || 'n.d.'})
              </p>

              <p style={{
                fontSize: '17px', lineHeight: 1.7,
                color: '#3d3d3d', marginBottom: '1.25rem',
                fontFamily: 'Georgia, serif',
              }}>
                {data?.summary}
              </p>

              {data?.coinages && data.coinages.length > 0 && (
                <div style={{ borderTop: '2px solid #ecdfa8', paddingTop: '1rem' }}>
                  <h4 style={{
                    fontSize: '16px', color: '#907040',
                    marginBottom: '0.5rem', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    Original Coinages
                  </h4>
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {data.coinages.map((c, i) => (
                      <li key={i} style={{
                        fontSize: '15px', color: '#555',
                        marginBottom: '0.4rem',
                        paddingLeft: '0.75rem',
                        borderLeft: '3px solid #ecdfa8',
                        lineHeight: 1.5,
                      }}>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '1rem', flexWrap: 'wrap',
      }}>
        <button className="btn btn-secondary" onClick={goPrev} disabled={currentIndex === 0}
          style={{ fontSize: '1.2rem', padding: '0.5rem 1rem' }}>
          &larr; Prev
        </button>

        <button className="btn btn-gold" onClick={() => setFlipped(f => !f)}
          style={{ fontSize: '1rem', padding: '0.5rem 1.25rem' }}>
          Flip
        </button>

        <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)', fontFamily: 'var(--font-heading)', minWidth: '80px', textAlign: 'center' }}>
          {currentIndex + 1} / {deck.length}
        </span>

        <button className="btn btn-secondary" onClick={shuffle}
          style={{ fontSize: '1rem', padding: '0.5rem 1.25rem' }}>
          Shuffle
        </button>

        <button className="btn btn-secondary" onClick={goNext} disabled={currentIndex >= deck.length - 1}
          style={{ fontSize: '1.2rem', padding: '0.5rem 1rem' }}>
          Next &rarr;
        </button>
      </div>
    </div>
  );
}

function CoverImage({ bookId, base }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(null);
    setFailed(false);
    const img = new Image();
    img.onload = () => setSrc(img.src);
    img.onerror = () => {
      const img2 = new Image();
      img2.onload = () => setSrc(img2.src);
      img2.onerror = () => setFailed(true);
      img2.src = `${base}covers/${bookId}.png`;
    };
    img.src = `${base}covers/${bookId}.jpg`;
  }, [bookId, base]);

  if (failed || !src) {
    return <div style={{
      width: '200px', height: '260px', borderRadius: '8px',
      background: '#2d3a2d', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#f0ebe2', fontFamily: 'var(--font-heading)',
      fontSize: '18px', textAlign: 'center', padding: '1rem',
    }}>
      No cover
    </div>;
  }

  return <img src={src} alt="" style={{
    width: '200px', height: '260px', objectFit: 'cover', borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  }} />;
}
