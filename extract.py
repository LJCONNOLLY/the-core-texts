#!/usr/bin/env python3
"""
extract.py — PDF + EPUB + MOBI + AZW3 + ZIP text extraction pipeline
for The Core Texts digital humanities archive.

Reads all supported ebook files from the repo root, extracts text and metadata,
flags definitional passages about "text" and "technology", and outputs:
  - data/index.json (metadata + definitions)
  - data/books/{book-id}.json (full text per book)
"""

import json
import os
import re
import subprocess
import sys
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path

import fitz  # PyMuPDF
from bs4 import BeautifulSoup

# Try importing optional libraries
try:
    import ebooklib
    from ebooklib import epub
    HAS_EBOOKLIB = True
except ImportError:
    HAS_EBOOKLIB = False

try:
    import mobi
    HAS_MOBI = True
except ImportError:
    HAS_MOBI = False

# ─── Configuration ───────────────────────────────────────────────────────────

ROOT_DIR = Path(__file__).parent
DATA_DIR = ROOT_DIR / "data"
BOOKS_DIR = DATA_DIR / "books"

SUPPORTED_EXTENSIONS = {".pdf", ".epub", ".mobi", ".azw3", ".zip"}

# Files to skip
SKIP_FILES = {
    "books/core list",
}

# Hardcoded metadata for files with non-standard names
MANUAL_METADATA = {
    "core2.pdf": {
        "title": "Race After Technology",
        "author": ["Ruha Benjamin"],
        "year": 2019,
        "publisher": "Polity Press",
    },
    "project_muse_63071-full.pdf": {
        "title": "Bodies of Information",
        "author": ["Elizabeth Losh", "Jacqueline Wernimont"],
        "year": 2018,
        "publisher": "University of Minnesota Press",
    },
    "whats the use.pdf": {
        "title": "What's the Use?: On the Uses of Use",
        "author": ["Sara Ahmed"],
        "year": 2019,
        "publisher": "Duke University Press",
    },
    "Designing Multilingual Experiences in Technical Communication.pdf": {
        "title": "Designing Multilingual Experiences in Technical Communication",
        "author": ["Laura Gonzales"],
        "year": 2022,
        "publisher": "Utah State University Press",
    },
}

# ─── Definitional language patterns ─────────────────────────────────────────

DEFINITION_PATTERNS_TEXT = [
    re.compile(r'\btext\s+(is|are|was|were|refers?\s+to|can\s+be\s+defined\s+as|means?|denotes?|signif\w*)', re.IGNORECASE),
    re.compile(r'\bdefin\w+\s+(?:of\s+)?(?:the\s+)?(?:term\s+)?["\']?text["\']?', re.IGNORECASE),
    re.compile(r'\bby\s+["\']?text["\']?\s*[,]?\s*(?:I\s+mean|we\s+mean|is\s+meant)', re.IGNORECASE),
    re.compile(r'\btext\s+(?:here|in\s+this)\s+(?:refers?|means?|denotes?)', re.IGNORECASE),
    re.compile(r'\bwhat\s+(?:is|do\w*\s+we\s+mean\s+by)\s+(?:a\s+)?["\']?text["\']?', re.IGNORECASE),
    re.compile(r'\btext\s+as\s+(?:a\s+)?(?:concept|term|category|framework|practice)', re.IGNORECASE),
    re.compile(r'\bconcept\s+of\s+(?:the\s+)?text\b', re.IGNORECASE),
    re.compile(r'\bunderstand(?:ing)?\s+(?:of\s+)?text\s+as\b', re.IGNORECASE),
]

DEFINITION_PATTERNS_TECHNOLOGY = [
    re.compile(r'\btechnology\s+(is|are|was|were|refers?\s+to|can\s+be\s+defined\s+as|means?|denotes?|signif\w*)', re.IGNORECASE),
    re.compile(r'\bdefin\w+\s+(?:of\s+)?(?:the\s+)?(?:term\s+)?["\']?technology["\']?', re.IGNORECASE),
    re.compile(r'\bby\s+["\']?technology["\']?\s*[,]?\s*(?:I\s+mean|we\s+mean|is\s+meant)', re.IGNORECASE),
    re.compile(r'\btechnology\s+(?:here|in\s+this)\s+(?:refers?|means?|denotes?)', re.IGNORECASE),
    re.compile(r'\bwhat\s+(?:is|do\w*\s+we\s+mean\s+by)\s+(?:a\s+)?["\']?technology["\']?', re.IGNORECASE),
    re.compile(r'\btechnology\s+as\s+(?:a\s+)?(?:concept|term|category|framework|practice)', re.IGNORECASE),
    re.compile(r'\bconcept\s+of\s+technology\b', re.IGNORECASE),
    re.compile(r'\bunderstand(?:ing)?\s+(?:of\s+)?technology\s+as\b', re.IGNORECASE),
]

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
    """Get metadata for a file, using manual overrides, filename parsing, or file metadata."""
    filename = os.path.basename(filepath)

    if filename in MANUAL_METADATA:
        meta = MANUAL_METADATA[filename].copy()
        meta.setdefault("isbn", None)
        meta.setdefault("publisher", None)
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
    """Generate a unique book ID from metadata."""
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

def extract_pdf(filepath):
    """Extract text from PDF page by page using PyMuPDF. Falls back to OCR for scanned PDFs."""
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
                    tp = page.get_textpage_ocr(flags=0, full=True)
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

    pdf_meta = doc.metadata or {}
    doc.close()

    file_metadata = {}
    if pdf_meta.get("title"):
        file_metadata["title"] = pdf_meta["title"]
    if pdf_meta.get("author"):
        file_metadata["author"] = [a.strip() for a in pdf_meta["author"].split(",")]

    return pages, file_metadata


def extract_epub(filepath):
    """Extract text from EPUB chapter by chapter."""
    if not HAS_EBOOKLIB:
        raise ImportError("ebooklib is required for EPUB extraction")

    book = epub.read_epub(str(filepath), options={"ignore_ncx": True})
    sections = []
    section_num = 0

    for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
        content = item.get_content()
        soup = BeautifulSoup(content, 'html.parser')
        text = soup.get_text(separator='\n', strip=True)

        if text and len(text.strip()) > 50:
            section_num += 1
            sections.append({
                "locator": section_num,
                "locator_type": "section",
                "text": text.strip()
            })

    epub_meta = {}
    try:
        title_list = book.get_metadata('DC', 'title')
        if title_list:
            epub_meta["title"] = title_list[0][0]
    except Exception:
        pass
    try:
        creator_list = book.get_metadata('DC', 'creator')
        if creator_list:
            epub_meta["author"] = [c[0] for c in creator_list]
    except Exception:
        pass
    try:
        date_list = book.get_metadata('DC', 'date')
        if date_list:
            year = extract_year(date_list[0][0])
            if year:
                epub_meta["year"] = year
    except Exception:
        pass
    try:
        pub_list = book.get_metadata('DC', 'publisher')
        if pub_list:
            epub_meta["publisher"] = pub_list[0][0]
    except Exception:
        pass

    return sections, epub_meta


def extract_mobi_or_azw3(filepath):
    """Extract text from MOBI/AZW3 using the mobi library, with Calibre fallback."""
    errors = []

    # Try mobi library first
    if HAS_MOBI:
        try:
            with tempfile.TemporaryDirectory() as tmpdir:
                tempdir, extracted = mobi.extract(str(filepath))
                html_files = []
                for root, dirs, files in os.walk(tempdir):
                    for f in files:
                        if f.endswith(('.html', '.htm', '.xhtml')):
                            html_files.append(os.path.join(root, f))

                if html_files:
                    sections = []
                    section_num = 0
                    for html_file in sorted(html_files):
                        with open(html_file, 'r', encoding='utf-8', errors='replace') as hf:
                            soup = BeautifulSoup(hf.read(), 'html.parser')
                            text = soup.get_text(separator='\n', strip=True)
                            if text and len(text.strip()) > 50:
                                section_num += 1
                                sections.append({
                                    "locator": section_num,
                                    "locator_type": "section",
                                    "text": text.strip()
                                })
                    if sections:
                        return sections, {}
        except Exception as e:
            errors.append(f"mobi library failed: {e}")

    # Fallback: try Calibre ebook-convert
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            epub_path = os.path.join(tmpdir, "converted.epub")
            result = subprocess.run(
                ["ebook-convert", str(filepath), epub_path],
                capture_output=True, text=True, timeout=120
            )
            if result.returncode == 0 and os.path.exists(epub_path):
                return extract_epub(epub_path)
            else:
                errors.append(f"Calibre conversion failed: {result.stderr[:200]}")
    except FileNotFoundError:
        errors.append("Calibre ebook-convert not found")
    except subprocess.TimeoutExpired:
        errors.append("Calibre conversion timed out")
    except Exception as e:
        errors.append(f"Calibre fallback failed: {e}")

    raise RuntimeError("; ".join(errors))


def extract_zip_text(filepath):
    """Extract text from ZIP containing numbered text files (Internet Archive OCR format)."""
    pages = []
    with zipfile.ZipFile(filepath) as z:
        txt_files = [n for n in z.namelist() if n.endswith('.txt')]
        for name in sorted(txt_files, key=lambda n: int(re.search(r'\d+', n.split('/')[-1]).group()) if re.search(r'\d+', n.split('/')[-1]) else 0):
            try:
                page_match = re.search(r'(\d+)', name.split('/')[-1])
                if not page_match:
                    continue
                page_num = int(page_match.group(1))
                text = z.read(name).decode('utf-8', errors='replace').strip()
                if text and len(text) > 10:
                    pages.append({
                        "locator": page_num,
                        "locator_type": "page",
                        "text": text
                    })
            except Exception:
                continue

    if not pages:
        raise RuntimeError("No text files found in ZIP archive")

    return pages, {"note": "OCR-scanned text from Internet Archive; search results may be imprecise"}


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
    """Scan pages/sections for definitional language about 'text' and 'technology'."""
    definitions = {"text": [], "technology": []}

    for page in pages:
        text = page["text"]

        for pattern in DEFINITION_PATTERNS_TEXT:
            for match in pattern.finditer(text):
                excerpt = extract_sentence(text, match.start(), match.end())
                if len(excerpt) > 30:
                    definitions["text"].append({
                        "locator": page["locator"],
                        "locator_type": page["locator_type"],
                        "excerpt": excerpt[:1000],
                    })

        for pattern in DEFINITION_PATTERNS_TECHNOLOGY:
            for match in pattern.finditer(text):
                excerpt = extract_sentence(text, match.start(), match.end())
                if len(excerpt) > 30:
                    definitions["technology"].append({
                        "locator": page["locator"],
                        "locator_type": page["locator_type"],
                        "excerpt": excerpt[:1000],
                    })

    # Deduplicate by excerpt similarity
    for key in definitions:
        seen = set()
        unique = []
        for d in definitions[key]:
            norm = d["excerpt"][:100].lower().strip()
            if norm not in seen:
                seen.add(norm)
                unique.append(d)
        definitions[key] = unique

    return definitions


# ─── Main pipeline ───────────────────────────────────────────────────────────

def find_ebook_files(root_dir):
    """Find all supported ebook files in the root directory."""
    files = []
    for f in sorted(os.listdir(root_dir)):
        if os.path.isfile(os.path.join(root_dir, f)):
            ext = Path(f).suffix.lower()
            if ext in SUPPORTED_EXTENSIONS:
                full_path = os.path.join(root_dir, f)
                rel_path = os.path.relpath(full_path, root_dir)
                if rel_path not in SKIP_FILES:
                    files.append(full_path)
    return files


def process_file(filepath):
    """Process a single ebook file. Returns (book_data, error) tuple."""
    filename = os.path.basename(filepath)
    ext = Path(filename).suffix.lower()

    # Get metadata from filename or manual overrides
    metadata = get_metadata(filepath)

    # Extract text based on format
    try:
        if ext == '.pdf':
            pages, file_meta = extract_pdf(filepath)
            fmt = "pdf"
        elif ext == '.epub':
            pages, file_meta = extract_epub(filepath)
            fmt = "epub"
        elif ext in ('.mobi', '.azw3'):
            pages, file_meta = extract_mobi_or_azw3(filepath)
            fmt = ext[1:]  # "mobi" or "azw3"
        elif ext == '.zip':
            pages, file_meta = extract_zip_text(filepath)
            fmt = "zip"
        else:
            return None, f"Unsupported format: {ext}"
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

    book_data = {
        "id": book_id,
        "filename": filename,
        "title": metadata.get("title", filename),
        "author": metadata.get("author", []),
        "year": metadata.get("year"),
        "publisher": metadata.get("publisher"),
        "isbn": metadata.get("isbn"),
        "format": fmt,
        "frameworks": [],
        "definitions": definitions,
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

    # Find all ebook files
    files = find_ebook_files(ROOT_DIR)
    print(f"Found {len(files)} ebook files to process.\n")

    # Process each file
    books = []
    errors = []
    format_counts = {"pdf": 0, "epub": 0, "mobi": 0, "azw3": 0, "zip": 0}
    definition_counts = {"text": 0, "technology": 0}

    for i, filepath in enumerate(files, 1):
        filename = os.path.basename(filepath)
        ext = Path(filename).suffix.lower()[1:]
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
                "pages": book_data["pages"],
            }, f, ensure_ascii=False, indent=2)

        # Remove full text from index entry (keep only metadata)
        index_entry = {k: v for k, v in book_data.items() if k != "pages"}
        books.append(index_entry)

        format_counts[book_data["format"]] = format_counts.get(book_data["format"], 0) + 1
        definition_counts["text"] += len(book_data["definitions"]["text"])
        definition_counts["technology"] += len(book_data["definitions"]["technology"])

        print(f"  ✓ {book_data['title']}")
        print(f"    Author: {', '.join(book_data['author']) if book_data['author'] else 'Unknown'}")
        print(f"    {book_data['page_count']} {book_data['pages'][0]['locator_type'] + 's' if book_data.get('pages') else 'pages'}, "
              f"{book_data['word_count']:,} words, "
              f"{len(book_data['definitions']['text'])} text defs, "
              f"{len(book_data['definitions']['technology'])} tech defs")

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

    # Print summary
    print()
    print("=" * 60)
    print("  EXTRACTION SUMMARY")
    print("=" * 60)
    print(f"  Total files found:    {len(files)}")
    print(f"  Successfully processed: {len(books)}")
    print(f"  Failed:               {len(errors)}")
    print()
    print("  Format breakdown:")
    for fmt, count in sorted(format_counts.items()):
        if count > 0:
            print(f"    {fmt.upper():6s}: {count}")
    print()
    print("  Definitions flagged:")
    print(f"    'text':       {definition_counts['text']} passages")
    print(f"    'technology': {definition_counts['technology']} passages")
    print()

    if errors:
        print("  Failed files:")
        for err in errors:
            print(f"    ✗ {err['file']}: {err['error']}")
        print()

    print(f"  Output: {index_path}")
    print(f"  Books:  {BOOKS_DIR}/")
    print("=" * 60)


if __name__ == "__main__":
    main()
