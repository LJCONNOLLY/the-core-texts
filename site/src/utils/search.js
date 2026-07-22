import { loadSearchManifest, loadChunkIndex, loadPostingsShard, loadBook } from './data';

// MUST match tokenize()/STOPWORDS in extract.py exactly — postings are
// looked up by these exact token strings.
const TOKEN_RE = /[a-z0-9]+/g;

const STOPWORDS = new Set([
  'a', 'about', 'after', 'all', 'also', 'am', 'an', 'and', 'any', 'are',
  'as', 'at', 'be', 'because', 'been', 'being', 'but', 'by', 'can',
  'could', 'did', 'do', 'does', 'each', 'for', 'from', 'had', 'has',
  'have', 'he', 'her', 'his', 'how', 'if', 'in', 'into', 'is', 'it',
  'its', 'just', 'may', 'might', 'more', 'most', 'must', 'no', 'not',
  'of', 'on', 'onto', 'or', 'other', 'our', 'own', 'shall', 'she',
  'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their',
  'them', 'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'to', 'up', 'was', 'we', 'were', 'what', 'when', 'where', 'which',
  'who', 'whom', 'why', 'will', 'with', 'would', 'you', 'your',
]);

export function tokenize(text) {
  const matches = text.toLowerCase().match(TOKEN_RE) || [];
  return matches.filter(t => t.length >= 2 && !STOPWORDS.has(t));
}

// MUST match fnv1a32() in extract.py exactly — shard assignment has to
// agree between build time (Python) and query time (here). Only valid
// for pure-ASCII input, which the tokenizer guarantees.
export function fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const K1 = 1.5;
const B = 0.75;
const SNIPPET_RADIUS = 90;

async function getPostings(term, manifest) {
  const shardIdx = fnv1a32(term) % manifest.shard_count;
  const shard = await loadPostingsShard(shardIdx);
  return shard[term];
}

function buildSnippet(chunkText, pageText, terms) {
  let source = chunkText;
  let idx = -1;
  const lowerChunk = chunkText.toLowerCase();
  for (const t of terms) {
    idx = lowerChunk.indexOf(t.toLowerCase());
    if (idx !== -1) break;
  }
  if (idx === -1) {
    source = pageText;
    const lowerPage = pageText.toLowerCase();
    for (const t of terms) {
      idx = lowerPage.indexOf(t.toLowerCase());
      if (idx !== -1) break;
    }
  }
  if (idx === -1) return source.slice(0, 200);
  const start = Math.max(0, idx - SNIPPET_RADIUS);
  const end = Math.min(source.length, idx + SNIPPET_RADIUS);
  return source.slice(start, end);
}

/**
 * Ranked full-text search over the prebuilt index. Returns
 * [{ bookId, locator, locatorType, snippet, score }], highest score first.
 */
export async function search(query, { exactPhrase = false, limit = 30 } = {}) {
  const tokens = [...new Set(tokenize(query))];
  if (tokens.length === 0) return [];

  const manifest = await loadSearchManifest();
  if (!manifest.chunk_count) return [];
  const chunkIndex = await loadChunkIndex();

  const scores = new Map(); // chunkId -> BM25 score

  for (const term of tokens) {
    const postings = await getPostings(term, manifest);
    if (!postings) continue;
    const df = postings.length;
    const idf = Math.log(1 + (manifest.chunk_count - df + 0.5) / (df + 0.5));
    for (const [chunkId, tf] of postings) {
      const chunkLen = chunkIndex[chunkId][2];
      const denom = tf + K1 * (1 - B + B * chunkLen / manifest.avgdl);
      const score = idf * (tf * (K1 + 1)) / denom;
      scores.set(chunkId, (scores.get(chunkId) || 0) + score);
    }
  }

  if (scores.size === 0) return [];

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);

  // Dedupe by book+locator — a long chapter can produce several top chunks.
  const seen = new Set();
  const deduped = [];
  for (const [chunkId, score] of ranked) {
    const [bookIdx, locator] = chunkIndex[chunkId];
    const key = `${bookIdx}:${locator}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ chunkId, score });
  }

  // Exact-phrase mode can't do adjacency matching on a token index, so it
  // widens the candidate pool and post-filters on the real fetched text.
  const candidates = deduped.slice(0, exactPhrase ? Math.max(limit, 100) : limit);

  const uniqueBookIds = [...new Set(
    candidates.map(({ chunkId }) => manifest.book_ids[chunkIndex[chunkId][0]])
  )];
  const bookEntries = await Promise.all(uniqueBookIds.map(async id => {
    try {
      return [id, await loadBook(id)];
    } catch {
      return [id, null];
    }
  }));
  const bookMap = new Map(bookEntries);

  const queryLower = query.toLowerCase();
  const results = [];

  for (const { chunkId, score } of candidates) {
    const [bookIdx, locator, , wordStart, wordEnd] = chunkIndex[chunkId];
    const book = bookMap.get(manifest.book_ids[bookIdx]);
    if (!book) continue;

    const page = book.pages.find(p => p.locator === locator);
    if (!page) continue;

    if (exactPhrase && !page.text.toLowerCase().includes(queryLower)) continue;

    const words = page.text.trim().split(/\s+/);
    const chunkText = words.slice(wordStart, wordEnd).join(' ');
    const snippet = buildSnippet(chunkText, page.text, exactPhrase ? [query] : tokens);

    results.push({
      bookId: manifest.book_ids[bookIdx],
      locator,
      locatorType: page.locator_type,
      snippet,
      score,
    });

    if (results.length >= limit) break;
  }

  return results;
}
