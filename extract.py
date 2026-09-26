#!/usr/bin/env python3
"""
extract.py — PDF text extraction pipeline for The Core Texts digital
humanities archive.

Every book on the core list is a PDF in pdfs/ named by its book id, with its
metadata in pdfs/manifest.json (books that began as EPUB/MOBI/AZW3/ZIP are
converted by to_pdf.py). This script extracts each PDF's text page by page,
records the print edition's page numbers where it can, flags definitional
passages about glossary terms, and outputs:
  - data/index.json (metadata + definitions)
  - data/books/{book-id}.json (full text per book)
  - data/search/ (prebuilt full-text search index)
"""

import json
import os
import re
from datetime import datetime
from pathlib import Path

import fitz  # PyMuPDF

import layout

# ─── Configuration ───────────────────────────────────────────────────────────

ROOT_DIR = Path(__file__).parent
DATA_DIR = ROOT_DIR / "data"
BOOKS_DIR = DATA_DIR / "books"
PDF_DIR = ROOT_DIR / "pdfs"

# id -> {title, author, year, publisher, isbn, source}
MANIFEST = json.loads((PDF_DIR / "manifest.json").read_text(encoding="utf-8"))

# ─── Definitional language patterns ─────────────────────────────────────────

# Load glossary terms to flag definitions for all of them
def load_glossary_terms():
    """Load term names from glossary.json."""
    glossary_path = ROOT_DIR / "glossary.json"
    if glossary_path.exists():
        with open(glossary_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        # Extract the primary word(s) for each term
        terms = []
        for entry in data.get("terms", []):
            term = entry.get("term", entry.get("id", ""))
            # Handle "Visibility / Invisibility" -> search for both
            for part in re.split(r'\s*/\s*', term):
                part = part.strip()
                if part and len(part) > 2:
                    terms.append(part.lower())
        return terms
    return ["text", "technology"]

GLOSSARY_TERMS = load_glossary_terms()


def build_definition_patterns(term):
    """Build regex patterns to detect definitional language for a given term."""
    # Escape the term for regex
    t = re.escape(term)
    return [
        re.compile(rf'\b{t}\s+(is|are|was|were|refers?\s+to|can\s+be\s+defined\s+as|means?|denotes?|signif\w*)', re.IGNORECASE),
        re.compile(rf'\bdefin\w+\s+(?:of\s+)?(?:the\s+)?(?:term\s+)?["\']?{t}["\']?', re.IGNORECASE),
        re.compile(rf'\bby\s+["\']?{t}["\']?\s*[,]?\s*(?:I\s+mean|we\s+mean|is\s+meant)', re.IGNORECASE),
        re.compile(rf'\b{t}\s+(?:here|in\s+this)\s+(?:refers?|means?|denotes?)', re.IGNORECASE),
        re.compile(rf'\bwhat\s+(?:is|do\w*\s+we\s+mean\s+by)\s+(?:a\s+)?["\']?{t}["\']?', re.IGNORECASE),
        re.compile(rf'\b{t}\s+as\s+(?:a\s+)?(?:concept|term|category|framework|practice)', re.IGNORECASE),
        re.compile(rf'\bconcept\s+of\s+(?:the\s+)?{t}\b', re.IGNORECASE),
        re.compile(rf'\bunderstand(?:ing)?\s+(?:of\s+)?{t}\s+as\b', re.IGNORECASE),
    ]


# Pre-build patterns for all glossary terms
TERM_PATTERNS = {term: build_definition_patterns(term) for term in GLOSSARY_TERMS}

# ─── Filename parser ────────────────────────────────────────────────────────

def slugify(text):
    """Create a URL-friendly slug from text."""
    text = text.lower().strip()
    text = re.sub(r'[ǂ]+', '', text)
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')[:80]


def clean_title(title):
    """Clean up title from filename."""
    # Remove MARC non-filing indicators
    title = title.replace('ǂ', '').strip()
    # Fix encoded colons and underscores used as separators
    title = re.sub(r'\s*_\s*', ': ', title)
    # Fix double colons
    title = re.sub(r':\s*:', ':', title)
    # Clean up whitespace
    title = re.sub(r'\s{2,}', ' ', title)
    # Remove trailing punctuation
    title = re.sub(r'\s*[,:;_]\s*$', '', title)
    return title.strip()


def clean_author(author_str):
    """Parse author string into list of clean author names."""
    author_str = re.sub(r'\[.*?\]', '', author_str)
    author_str = re.sub(r'\((?:author|editor|Foreword\s+by|contributor)\)', '', author_str, flags=re.IGNORECASE)
    author_str = re.sub(r',\s*\d{4}-?\d{0,4}\s*$', '', author_str)
    author_str = author_str.strip().rstrip(';').strip()

    authors = []
    for sep in [' & ', '; ']:
        if sep in author_str:
            parts = author_str.split(sep)
            for part in parts:
                part = part.strip().rstrip(';').rstrip(',').strip()
                if part and not part.lower().startswith('netlibrary') and not part.lower().startswith('inscribe'):
                    authors.append(normalize_author_name(part))
            return [a for a in authors if a]

    # Handle comma-separated authors that aren't "Last, First" format
    # If there are 3+ comma-separated parts, likely multiple authors
    comma_parts = [p.strip() for p in author_str.split(',')]
    if len(comma_parts) >= 3 and all(len(p.split()) <= 3 for p in comma_parts if p):
        return [p.strip() for p in comma_parts if p.strip()]

    author_str = author_str.strip()
    if author_str:
        authors.append(normalize_author_name(author_str))
    return [a for a in authors if a]


def normalize_author_name(name):
    """Convert 'Last, First' to 'First Last' and fix underscores."""
    name = name.strip()
    # Replace underscores with periods (Anna's Archive encoding)
    name = re.sub(r'(\w)_(\s)', r'\1.\2', name)
    name = re.sub(r'(\w)_$', r'\1.', name)
    # Fix "Jr" suffix handling
    name = re.sub(r'^Jr\.?\s+', '', name)
    # Remove extra spaces
    name = re.sub(r'\s{2,}', ' ', name)
    if ',' in name:
        parts = name.split(',', 1)
        last = parts[0].strip()
        first = parts[1].strip()
        if first and not re.match(r'^\d', first):
            # Handle "Jr" or "Jr." suffix
            if first.lower().rstrip('.') == 'jr':
                return f"{last} Jr."
            return f"{first} {last}"
    return name


def extract_year(text):
    """Extract the earliest publication year from text."""
    years = re.findall(r'\b((?:19|20)\d{2})\b', text)
    if years:
        return min(int(y) for y in years)
    return None


def parse_anna_filename(filename):
    """Parse metadata from Anna's Archive filename format."""
    stem = Path(filename).stem
    ext = Path(filename).suffix.lower()

    parts = stem.split(' -- ')
    # Handle both straight and curly apostrophes in "Anna's Archive"
    anna_variants = ["Anna's Archive", "Anna\u2019s Archive"]
    if len(parts) < 3 or not any(v in parts[-1] for v in anna_variants):
        return None

    parts = [p.strip() for p in parts if p.strip() not in anna_variants]

    hash_idx = None
    isbn_idx = None
    for i, part in enumerate(parts):
        if re.match(r'^[0-9a-f]{32}$', part):
            hash_idx = i
        if part.lower().startswith('isbn13'):
            isbn_idx = i

    title = clean_title(parts[0]) if len(parts) > 0 else None
    author = clean_author(parts[1]) if len(parts) > 1 else []

    year = None
    publisher = None

    meta_parts = parts[2:hash_idx] if hash_idx else parts[2:]
    meta_parts = [p for p in meta_parts if not re.match(r'^[0-9a-f]{32}$', p) and not p.lower().startswith('isbn13')]

    for part in meta_parts:
        y = extract_year(part)
        if y and not year:
            year = y
        elif not re.match(r'^[0-9a-f]{32}$', part):
            publisher = part.strip()

    isbn = None
    if isbn_idx is not None:
        isbn_match = re.search(r'isbn13\s+(\d{13})', parts[isbn_idx], re.IGNORECASE)
        if isbn_match:
            isbn = isbn_match.group(1)

    return {
        "title": title,
        "author": author,
        "year": year,
        "publisher": publisher,
        "isbn": isbn,
    }


def get_metadata(filepath):
    """Get metadata for a PDF from the manifest, else its filename."""
    filename = os.path.basename(filepath)
    stem = Path(filename).stem

    if stem in MANIFEST:
        meta = {k: v for k, v in MANIFEST[stem].items() if k != "source"}
        meta["id"] = stem
        return meta

    parsed = parse_anna_filename(filename)
    if parsed:
        return parsed

    title = Path(filename).stem.replace('_', ' ').replace('-', ' ')
    return {
        "title": title,
        "author": [],
        "year": None,
        "publisher": None,
        "isbn": None,
    }


def make_book_id(metadata):
    """The manifest's id, else one generated from the metadata."""
    if metadata.get("id"):
        return metadata["id"]
    author_part = ""
    if metadata.get("author"):
        first_author = metadata["author"][0]
        last_name = first_author.split()[-1] if first_author else "unknown"
        author_part = slugify(last_name)

    title_part = slugify(metadata.get("title", "unknown"))
    if len(title_part) > 40:
        title_part = title_part[:40].rstrip('-')

    return f"{author_part}-{title_part}" if author_part else title_part


# ─── Text extraction ────────────────────────────────────────────────────────

# Books whose PDF maps the fi/fl/ff ligature glyphs to a bare "f"
# ("workfow", "signifcant"); the words are repaired against a dictionary.
LIGATURE_BOOKS = {"tham-design-thinking-in-technical-communicati"}
LIGATURE_WORDS = {"workfow": "workflow", "afordance": "affordance", "afordances": "affordances",
                  "pfster": "pfister", "brufee": "bruffee"}
_speller = None


def repair_ligatures(text):
    """ "signifcant" -> "significant", "refection" -> "reflection" ... """
    global _speller
    if _speller is None:
        from spellchecker import SpellChecker
        _speller = SpellChecker()

    def fix(m):
        word = m.group(0)
        low = word.lower()
        if low in LIGATURE_WORDS:
            best = LIGATURE_WORDS[low]
        else:
            options = [low[:i] + lig + low[i + 1:] for i, ch in enumerate(low) if ch == "f"
                       for lig in ("fi", "fl", "ff", "ffi", "ffl")]
            options = [o for o in options if o in _speller]
            if not options:
                return word
            best = max(options, key=_speller.word_usage_frequency)
            # A real word can hide a lost ligature ("refection"); swap only when
            # the ligature reading is far more common.
            if low in _speller and _speller.word_usage_frequency(best) < 30 * _speller.word_usage_frequency(low):
                return word
        if word.isupper():
            return best.upper()
        return best[0].upper() + best[1:] if word[0].isupper() else best

    return re.sub(r"[A-Za-z]*f[A-Za-z]*", fix, text)


# The "[p. 47]" markers to_pdf.py places where the print edition turns a page.
PRINT_MARK = re.compile(r"\[p\. ([0-9]+|[ivxlcdm]+)\]", re.IGNORECASE)


def printed_pages(pages):
    """Map PDF page locators to the page numbers printed in their heads/feet.

    Candidate numbers come from each page's first and last lines; the offset
    between printed and PDF numbering that most pages agree on is trusted, and
    pages without a readable number borrow the offset of the nearest page that
    has one (offsets shift where unnumbered plates are bound in).
    """
    confirmed = {}
    cands = {}
    for p in pages:
        lines = [l for l in p["text"].split("\n") if l.strip()]
        nums = set()
        for l in lines[:3] + lines[-2:]:
            nums |= {int(n) for n in re.findall(r"(?<![\d.,:–-])\b(\d{1,3})\b(?![\d.,:–-]\d)", l)}
        cands[p["locator"]] = nums
    offsets = {}
    for loc, nums in cands.items():
        for n in nums:
            offsets[n - loc] = offsets.get(n - loc, 0) + 1
    good = {o for o, c in offsets.items() if c >= 10}
    for loc, nums in cands.items():
        hits = [n for n in nums if n - loc in good]
        if len(hits) == 1:
            confirmed[loc] = hits[0]
    # Keep a reading only if nearby pages agree on the offset (OCR noise and
    # stray numbers in the text don't), and give up on books with few readings.
    offset = {loc: n - loc for loc, n in confirmed.items()}

    def local_majority(loc):
        window = [offset[l] for l in range(loc - 10, loc + 11) if l in offset]
        return max(set(window), key=window.count)

    confirmed = {loc: n for loc, n in confirmed.items()
                 if offset[loc] == local_majority(loc)
                 and sum(offset.get(loc + d) == offset[loc] for d in range(-5, 6) if d) >= 2}
    if len(confirmed) < len(pages) * 0.3:
        return {}
    known = sorted(confirmed)
    out = {}
    for p in pages:
        loc = p["locator"]
        if loc in confirmed:
            out[loc] = confirmed[loc]
            continue
        near = min(known, key=lambda k: abs(k - loc))
        if abs(near - loc) <= 3:
            out[loc] = confirmed[near] + (loc - near)
    return {k: v for k, v in out.items() if v > 0}


def extract_pdf(filepath, converted=False):
    """Extract text from PDF page by page using PyMuPDF. Falls back to OCR for scanned PDFs.

    Each page records `print_pages`, the first and last print-edition page it
    covers: from to_pdf.py's markers in a converted book, otherwise from the
    page numbers in the running heads. `converted` PDFs also carry Calibre's
    footer page number, which is dropped from the text.
    """
    doc = fitz.open(filepath)
    pages = []
    empty_count = 0

    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        if text and text.strip():
            pages.append({
                "locator": page_num + 1,
                "locator_type": "page",
                "text": text.strip()
            })
        else:
            empty_count += 1

    # If most pages are empty, try OCR (scanned PDF)
    if empty_count > len(doc) * 0.8 and len(doc) > 0:
        print(f"    ⚠ Scanned PDF detected ({empty_count}/{len(doc)} pages empty). Attempting OCR...")
        pages = []
        try:
            for page_num in range(len(doc)):
                page = doc[page_num]
                # Use PyMuPDF's OCR via Tesseract
                text = page.get_text("text", flags=fitz.TEXT_PRESERVE_WHITESPACE)
                if not text or not text.strip():
                    tp = page.get_textpage_ocr(flags=0, full=True, dpi=300)
                    text = page.get_text("text", textpage=tp)
                if text and text.strip():
                    pages.append({
                        "locator": page_num + 1,
                        "locator_type": "page",
                        "text": text.strip()
                    })
                if page_num % 50 == 0 and page_num > 0:
                    print(f"    OCR progress: {page_num}/{len(doc)} pages...")
        except Exception as e:
            print(f"    ⚠ OCR failed: {e}. Book will have limited/no text content.")

    if converted:
        current = None
        for p in pages:
            # Calibre's page number, which text extraction may put first or last
            for edge in (r"^\s*(\d{1,4})\s*\n", r"\n\s*(\d{1,4})\s*$"):
                m = re.search(edge, p["text"])
                if m and abs(int(m.group(1)) - p["locator"]) <= 2:
                    p["text"] = p["text"][:m.start()] + "\n" + p["text"][m.end():]
            p["text"] = p["text"].strip()
            if re.fullmatch(r"\d{1,4}", p["text"]):
                p["text"] = ""  # a blank page carrying only its number
            marks = PRINT_MARK.findall(p["text"])
            # A marker in the page's first line means the print page turns right there.
            first_line = p["text"].split("\n", 1)[0]
            start = marks[0] if marks and PRINT_MARK.search(first_line) else current or (marks[0] if marks else None)
            if marks:
                current = marks[-1]
            if start:
                p["print_pages"] = [start, current or start]
            p["text"] = re.sub(r"[ \t]*\n?[ \t]*" + PRINT_MARK.pattern + r"[ \t]*", " ", p["text"],
                               flags=re.IGNORECASE).strip()
        pages = [p for p in pages if p["text"]]
    else:
        for loc, printed in printed_pages(pages).items():
            pages[[p["locator"] for p in pages].index(loc)]["print_pages"] = [str(printed), str(printed)]

    # The PDF's bookmarks become the table of contents.
    # (Skipping bare page numbers: Ong's MOBI bookmarks every index entry.)
    toc = [{"title": title.strip(), "section": page, "level": level - 1}
           for level, title, page in doc.get_toc()
           if re.search(r"[A-Za-z]", title) and page > 0]

    # Headings and paragraphs as the page lays them out, for the reader
    book_id = Path(filepath).stem
    chapter_pages = {e["section"] for e in toc
                     if e["level"] <= 1 and not re.match(r"(?i)part\b", e["title"])} or None
    # Haraway's text layer spaces its lines at random, so line gaps and
    # indents say nothing about paragraphs there.
    blocks = layout.book_blocks(doc, chapter_pages, ragged=book_id.startswith("haraway-"))
    for p in pages:
        p["blocks"] = [b for b in blocks.get(p["locator"], []) if b["x"].strip()]

    if book_id in LIGATURE_BOOKS:
        for p in pages:
            p["text"] = repair_ligatures(p["text"])
            for b in p["blocks"]:
                b["x"] = repair_ligatures(b["x"])

    pdf_meta = doc.metadata or {}
    doc.close()

    file_metadata = {"toc": toc} if toc else {}
    if pdf_meta.get("title"):
        file_metadata["title"] = pdf_meta["title"]
    if pdf_meta.get("author"):
        file_metadata["author"] = [a.strip() for a in pdf_meta["author"].split(",")]

    return pages, file_metadata


# ─── Definition flagging ────────────────────────────────────────────────────

def extract_sentence(text, match_start, match_end):
    """Extract the full sentence containing a match."""
    sentence_start = max(0, text.rfind('.', max(0, match_start - 500), match_start) + 1)
    if sentence_start == 0:
        sentence_start = max(0, text.rfind('\n', max(0, match_start - 500), match_start) + 1)

    sentence_end = text.find('.', match_end)
    if sentence_end == -1 or sentence_end - match_end > 500:
        sentence_end = text.find('\n', match_end)
    if sentence_end == -1 or sentence_end - match_end > 500:
        sentence_end = min(len(text), match_end + 300)
    else:
        sentence_end += 1

    return text[sentence_start:sentence_end].strip()


def flag_definitions(pages):
    """Scan pages/sections for definitional language about all glossary terms."""
    definitions = {term: [] for term in GLOSSARY_TERMS}

    for page in pages:
        text = page["text"]

        for term, patterns in TERM_PATTERNS.items():
            for pattern in patterns:
                for match in pattern.finditer(text):
                    excerpt = extract_sentence(text, match.start(), match.end())
                    if len(excerpt) > 30:
                        definitions[term].append({
                            "locator": page["locator"],
                            "locator_type": page["locator_type"],
                            "excerpt": excerpt[:1000],
                        })

    # Deduplicate by excerpt similarity and remove empty terms
    result = {}
    for key in definitions:
        seen = set()
        unique = []
        for d in definitions[key]:
            norm = d["excerpt"][:100].lower().strip()
            if norm not in seen:
                seen.add(norm)
                unique.append(d)
        if unique:
            result[key] = unique

    return result


# ─── Search index building ──────────────────────────────────────────────────
#
# Builds a prebuilt full-text search index alongside the per-book JSON:
#   - data/search/manifest.json      generated_at, chunk_count, avgdl, shard_count, book_ids
#   - data/search/chunk-index.json   [bookIdx, locator, tokenCount, wordStart, wordEnd] per chunk
#   - data/search/postings/{n}.json  term -> [[chunkId, tf], ...], hash-sharded
#
# Chunk text itself is NOT duplicated here — the client reconstructs a chunk's
# text from the already-fetched data/books/{id}.json using wordStart/wordEnd.

SEARCH_DIR = DATA_DIR / "search"
POSTINGS_DIR = SEARCH_DIR / "postings"
SHARD_COUNT = 16
CHUNK_WINDOW = 220
CHUNK_MIN_TRAILING = 80

TOKEN_RE = re.compile(r'[a-z0-9]+')

STOPWORDS = {
    "a", "about", "after", "all", "also", "am", "an", "and", "any", "are",
    "as", "at", "be", "because", "been", "being", "but", "by", "can",
    "could", "did", "do", "does", "each", "for", "from", "had", "has",
    "have", "he", "her", "his", "how", "if", "in", "into", "is", "it",
    "its", "just", "may", "might", "more", "most", "must", "no", "not",
    "of", "on", "onto", "or", "other", "our", "own", "shall", "she",
    "should", "so", "some", "such", "than", "that", "the", "their",
    "them", "then", "there", "these", "they", "this", "those", "through",
    "to", "up", "was", "we", "were", "what", "when", "where", "which",
    "who", "whom", "why", "will", "with", "would", "you", "your",
}


def tokenize(text):
    """Lowercase alnum tokens, length >= 2, stopwords removed.
    MUST match the tokenizer in site/src/utils/search.js exactly, since
    postings are looked up by these exact token strings at query time."""
    return [t for t in TOKEN_RE.findall(text.lower()) if len(t) >= 2 and t not in STOPWORDS]


def fnv1a32(s):
    """Deterministic 32-bit FNV-1a hash, ASCII-only.
    MUST match fnv1a32() in site/src/utils/search.js exactly — shard
    assignment has to agree between build time (here) and query time (JS).
    Do NOT use Python's built-in hash() (randomized per process)."""
    h = 0x811c9dc5
    for b in s.encode('ascii'):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def chunk_bounds(n_words):
    """Split n_words into (start, end) windows of ~CHUNK_WINDOW words,
    merging a short trailing remainder into the previous chunk instead of
    leaving an orphaned tiny chunk."""
    if n_words == 0:
        return []
    if n_words <= CHUNK_WINDOW + CHUNK_MIN_TRAILING:
        return [(0, n_words)]
    bounds = []
    i = 0
    while n_words - i > CHUNK_WINDOW + CHUNK_MIN_TRAILING:
        bounds.append((i, i + CHUNK_WINDOW))
        i += CHUNK_WINDOW
    bounds.append((i, n_words))
    return bounds


def index_book_for_search(pages, book_idx, chunk_index, postings):
    """Chunk a book's pages and accumulate postings/chunk-index entries in place."""
    for page in pages:
        words = page["text"].split()
        for start, end in chunk_bounds(len(words)):
            chunk_id = len(chunk_index)
            chunk_text = " ".join(words[start:end])
            tokens = tokenize(chunk_text)

            tf_counts = {}
            for tok in tokens:
                tf_counts[tok] = tf_counts.get(tok, 0) + 1
            for tok, tf in tf_counts.items():
                postings.setdefault(tok, {})[chunk_id] = tf

            chunk_index.append([book_idx, page["locator"], len(tokens), start, end])


def write_search_index(chunk_index, postings, book_ids):
    """Write manifest.json, chunk-index.json, and hash-sharded postings/*.json."""
    SEARCH_DIR.mkdir(exist_ok=True)
    POSTINGS_DIR.mkdir(exist_ok=True)

    chunk_count = len(chunk_index)
    avgdl = (sum(c[2] for c in chunk_index) / chunk_count) if chunk_count else 0.0

    manifest = {
        "generated_at": datetime.now().isoformat(),
        "chunk_count": chunk_count,
        "avgdl": avgdl,
        "shard_count": SHARD_COUNT,
        "book_ids": book_ids,
    }
    with open(SEARCH_DIR / "manifest.json", 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False)

    with open(SEARCH_DIR / "chunk-index.json", 'w', encoding='utf-8') as f:
        json.dump(chunk_index, f, ensure_ascii=False)

    shards = [{} for _ in range(SHARD_COUNT)]
    for term, tf_by_chunk in postings.items():
        shard = shards[fnv1a32(term) % SHARD_COUNT]
        shard[term] = sorted(tf_by_chunk.items())

    for i, shard in enumerate(shards):
        with open(POSTINGS_DIR / f"{i}.json", 'w', encoding='utf-8') as f:
            json.dump(shard, f, ensure_ascii=False)

    return manifest


# ─── Main pipeline ───────────────────────────────────────────────────────────

def find_pdf_files(pdf_dir):
    """All PDFs in pdfs/."""
    return [str(p) for p in sorted(pdf_dir.glob("*.pdf"))]


def process_file(filepath):
    """Process a single PDF. Returns (book_data, error) tuple."""
    filename = os.path.basename(filepath)

    # Get metadata from the manifest (or the filename)
    metadata = get_metadata(filepath)
    source = (MANIFEST.get(Path(filename).stem) or {}).get("source")

    try:
        # Books Calibre rebuilt from an ebook: page numbers in the footer and
        # "[p. 47]" markers, rather than a scan's own running heads
        converted = bool(source) and source.lower().endswith((".epub", ".azw3", ".mobi"))
        pages, file_meta = extract_pdf(filepath, converted=converted)
    except Exception as e:
        return None, f"Extraction failed: {e}"

    # Merge file metadata into parsed metadata (file meta fills gaps)
    if file_meta.get("title") and not metadata.get("title"):
        metadata["title"] = file_meta["title"]
    if file_meta.get("author") and not metadata.get("author"):
        metadata["author"] = file_meta["author"]
    if file_meta.get("year") and not metadata.get("year"):
        metadata["year"] = file_meta["year"]
    if file_meta.get("publisher") and not metadata.get("publisher"):
        metadata["publisher"] = file_meta["publisher"]

    # Flag definitions
    definitions = flag_definitions(pages)

    # Calculate word count
    word_count = sum(len(p["text"].split()) for p in pages)

    # Build book data
    book_id = make_book_id(metadata)

    # Get TOC if available (from the PDF's bookmarks)
    toc = file_meta.get("toc", [])

    book_data = {
        "id": book_id,
        "filename": filename,
        "title": metadata.get("title", filename),
        "author": metadata.get("author", []),
        "year": metadata.get("year"),
        "publisher": metadata.get("publisher"),
        "isbn": metadata.get("isbn"),
        "format": "pdf",
        # What the book was before to_pdf.py made it a PDF
        "source_format": Path(source).suffix.lstrip(".").lower() if source else "pdf",
        "frameworks": [],
        "definitions": definitions,
        "toc": toc,
        "word_count": word_count,
        "page_count": len(pages),
        "pages": pages,
    }

    return book_data, None


def main():
    print("=" * 60)
    print("  The Core Texts — Extraction Pipeline")
    print("=" * 60)
    print()

    # Create output directories
    DATA_DIR.mkdir(exist_ok=True)
    BOOKS_DIR.mkdir(exist_ok=True)

    # Find all PDFs
    files = find_pdf_files(PDF_DIR)
    print(f"Found {len(files)} PDFs to process.\n")

    # Process each file
    books = []
    errors = []
    format_counts = {}  # source format -> count
    definition_counts = {}  # term -> count

    # Search index accumulators (see "Search index building" section above)
    search_book_ids = []
    search_chunk_index = []
    search_postings = {}

    for i, filepath in enumerate(files, 1):
        filename = os.path.basename(filepath)
        print(f"[{i}/{len(files)}] Processing: {filename[:70]}...")

        book_data, error = process_file(filepath)

        if error:
            errors.append({"file": filename, "error": error})
            print(f"  ✗ ERROR: {error}")
            continue

        # Save full text to per-book JSON
        book_file = BOOKS_DIR / f"{book_data['id']}.json"
        with open(book_file, 'w', encoding='utf-8') as f:
            json.dump({
                "id": book_data["id"],
                "title": book_data["title"],
                "author": book_data["author"],
                "toc": book_data.get("toc", []),
                "pages": book_data["pages"],
            }, f, ensure_ascii=False, indent=2)

        # Chunk + index this book's text for search before its pages leave memory
        book_idx = len(search_book_ids)
        search_book_ids.append(book_data["id"])
        index_book_for_search(book_data["pages"], book_idx, search_chunk_index, search_postings)

        # Remove full text from index entry (keep only metadata)
        index_entry = {k: v for k, v in book_data.items() if k != "pages"}
        books.append(index_entry)

        format_counts[book_data["source_format"]] = format_counts.get(book_data["source_format"], 0) + 1
        for term, defs in book_data["definitions"].items():
            definition_counts[term] = definition_counts.get(term, 0) + len(defs)

        print(f"  ✓ {book_data['title']}")
        print(f"    Author: {', '.join(book_data['author']) if book_data['author'] else 'Unknown'}")
        total_book_defs = sum(len(v) for v in book_data['definitions'].values())
        print(f"    {book_data['page_count']} {book_data['pages'][0]['locator_type'] + 's' if book_data.get('pages') else 'pages'}, "
              f"{book_data['word_count']:,} words, "
              f"{total_book_defs} definitions flagged")

    # Write index.json
    index = {
        "generated_at": datetime.now().isoformat(),
        "book_count": len(books),
        "books": sorted(books, key=lambda b: (b.get("author", [""])[0] if b.get("author") else "", b.get("title", ""))),
        "processing_errors": errors,
    }

    index_path = DATA_DIR / "index.json"
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(index, f, ensure_ascii=False, indent=2)

    # Write search index
    search_manifest = write_search_index(search_chunk_index, search_postings, search_book_ids)

    # Print summary
    print()
    print("=" * 60)
    print("  EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"  Total files found:    {len(files)}")
    print(f"  Successfully processed: {len(books)}")
    print(f"  Failed:               {len(errors)}")
    print()
    print("  Original formats (all now PDF):")
    for fmt, count in sorted(format_counts.items()):
        if count > 0:
            print(f"    {fmt.upper():6s}: {count}")
    print()
    total_defs = sum(definition_counts.values())
    print(f"  Definitions flagged: {total_defs} total across {len(definition_counts)} terms")
    for term, count in sorted(definition_counts.items(), key=lambda x: -x[1])[:15]:
        print(f"    '{term}': {count} passages")
    if len(definition_counts) > 15:
        print(f"    ... and {len(definition_counts) - 15} more terms")
    print()

    if errors:
        print("  Failed files:")
        for err in errors:
            print(f"    ✗ {err['file']}: {err['error']}")
        print()

    print(f"  Search index: {search_manifest['chunk_count']:,} chunks, "
          f"{len(search_postings):,} terms, {SHARD_COUNT} shards, avgdl={search_manifest['avgdl']:.1f}")
    print()

    print(f"  Output: {index_path}")
    print(f"  Books:  {BOOKS_DIR}/")
    print(f"  Search: {SEARCH_DIR}/")
    print("=" * 60)


if __name__ == "__main__":
    main()
