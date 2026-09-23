#!/usr/bin/env python3
"""
to_pdf.py — converts the core-list books that aren't PDFs into PDFs in pdfs/.

pdfs/manifest.json lists every book by id with its metadata; `source` points
at the original ebook in originals/ for books that were converted, and is
null for books that were PDFs to begin with (those live in pdfs/ as-is).

- EPUB / AZW3 / MOBI go through Calibre's ebook-convert. Where an EPUB records
  the print edition's page breaks, a small "[p. 47]" marker is inserted at each
  one so the PDF can be cited by print page (extract.py reads these back).
  Runs of tiny EPUB files (one per endnote, say) are merged first, since
  Calibre starts each file on a new page.
- Scanned PDFs without usable text (Rose) get an invisible OCR text layer
  over the original page images, so they are searchable like the rest.
- The Haraway ZIP is a folder of OCR'd page scans as plain text; PyMuPDF lays
  each file onto one PDF page so the original page breaks survive.

Usage: python3 to_pdf.py [book-id ...]   (default: every converted book)
Requires Calibre (ebook-convert) on the PATH, and PyMuPDF. Run extract.py
afterwards to rebuild the site data from the PDFs.
"""

import html
import json
import os
import re
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).parent
PDF_DIR = ROOT_DIR / "pdfs"

# Marks the print edition's page breaks, however the publisher encoded them.
PAGEBREAK = re.compile(
    r"<(?:span|div|a)\b(?=[^>]*(?:epub:type=\"pagebreak\"|role=\"doc-pagebreak\"))[^>]*?"
    r"(?:title|aria-label)=\"([^\"]*)\"[^>]*?(?:/>|>\s*</(?:span|div|a)>)"
)

PRINT_PAGE_CSS = (
    # Floated to the right edge of the line so it never splits the prose.
    ".print-page { float: right; margin-left: 0.5em; font-size: 0.7em; color: #777;"
    " font-family: sans-serif; font-style: normal; font-weight: normal; }\n"
)

CONVERT_OPTIONS = [
    "--paper-size", "letter",
    "--pdf-page-margin-left", "72", "--pdf-page-margin-right", "72",
    "--pdf-page-margin-top", "60", "--pdf-page-margin-bottom", "60",
    "--pdf-default-font-size", "12",
    "--pdf-serif-family", "DejaVu Serif",
    "--pdf-page-numbers",
]


def page_label(raw):
    """' Page 84. ' -> '84'"""
    return re.sub(r"(?i)^\s*page\s*|[.\s]+$", "", raw).strip()


def page_marker(match):
    label = page_label(html.unescape(match.group(1)))
    if not label:
        return match.group(0)
    return f'<span class="print-page">[p. {html.escape(label)}]</span>'


def body_inner(markup):
    m = re.search(r"<body[^>]*>(.*)</body>", markup, re.S)
    return m.group(1) if m else ""


def tiny_spine_runs(files, spine):
    """Runs of 3+ consecutive spine documents with almost no text.

    Calibre starts every spine document on a new PDF page, so an EPUB that
    stores each endnote as its own file (Latour) would get a page per note.
    """
    runs, run, started = [], [], False
    for href in spine:
        text = re.sub(r"<[^>]+>", " ", files.get(href, ""))
        # Leave front matter alone: Calibre swaps the cover document for its
        # image, which would drop anything merged into it.
        if len(text.split()) < 250 and started:
            run.append(href)
            continue
        started = True
        if len(run) >= 3:
            runs.append(run)
        run = []
    if len(run) >= 3:
        runs.append(run)
    return runs


def prepare_epub(epub_path, out_path):
    """Copy an EPUB for conversion: visible print-page markers in place of the
    invisible page-break anchors, and runs of tiny files merged into one.

    Returns how many print-page markers were inserted.
    """
    with zipfile.ZipFile(epub_path) as src:
        items = [(i, src.read(i.filename)) for i in src.infolist()]
    data = {i.filename: d for i, d in items}

    container = data["META-INF/container.xml"].decode()
    opf_path = re.search(r'full-path="([^"]+)"', container).group(1)
    opf_dir = opf_path.rsplit("/", 1)[0] + "/" if "/" in opf_path else ""
    opf = data[opf_path].decode("utf-8")
    manifest = {m.group(2): m.group(1) for m in re.finditer(
        r'<item\b(?=[^>]*\bid="([^"]+)")(?=[^>]*\bhref="([^"]+)")[^>]*>', opf)}
    ids_to_href = {v: k for k, v in manifest.items()}
    spine = [ids_to_href[i] for i in re.findall(r'<itemref\b[^>]*\bidref="([^"]+)"', opf) if i in ids_to_href]

    docs = {h: data[opf_dir + h].decode("utf-8") for h in spine if opf_dir + h in data}
    count = 0
    for href, markup in docs.items():
        markup, n = PAGEBREAK.subn(page_marker, markup)
        count += n
        docs[href] = markup

    # Merge each run of tiny documents into its first document.
    renamed = {}
    for run in tiny_spine_runs(docs, spine):
        head = run[0]
        extra = "".join(body_inner(docs[h]) for h in run[1:])
        docs[head] = docs[head].replace("</body>", extra + "</body>", 1)
        for h in run[1:]:
            renamed[h.rsplit("/", 1)[-1]] = head.rsplit("/", 1)[-1]
            opf = re.sub(rf'<itemref\b[^>]*\bidref="{re.escape(manifest[h])}"[^>]*/>', "", opf)
    if renamed:
        link = re.compile(r'href="([^"#]*?)(' + "|".join(map(re.escape, renamed)) + r')(#[^"]*)?"')
        for href in docs:
            docs[href] = link.sub(lambda m: f'href="{m.group(1)}{renamed[m.group(2)]}{m.group(3) or ""}"', docs[href])

    with zipfile.ZipFile(out_path, "w") as dst:
        for item, content in items:
            name = item.filename
            rel = name[len(opf_dir):] if name.startswith(opf_dir) else None
            if name == opf_path:
                content = opf.encode("utf-8")
            elif rel in docs:
                content = docs[rel].encode("utf-8")
            elif name.lower().endswith(".css"):
                content = content + b"\n" + PRINT_PAGE_CSS.encode()
            # The mimetype entry must stay first and uncompressed.
            compress = zipfile.ZIP_STORED if name == "mimetype" else zipfile.ZIP_DEFLATED
            dst.writestr(item, content, compress_type=compress)
    return count


# A TrueType font with curly quotes and dashes; PDF's built-in Times lacks them.
SERIF_FONT = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"


def zip_pages_to_pdf(zip_path, dest, meta):
    """Lay each OCR'd page scan onto exactly one PDF page, shrinking the type
    only as far as a dense page needs, so the book's page breaks survive."""
    import pymupdf as fitz

    with zipfile.ZipFile(zip_path) as z:
        names = sorted(n for n in z.namelist() if n.endswith(".txt"))
        pages = [z.read(n).decode("utf-8", "replace") for n in names]
    doc = fitz.open()
    for text in pages:
        page = doc.new_page(width=612, height=792)
        box = fitz.Rect(72, 60, 540, 732)
        size = 11.0
        # insert_textbox returns a negative number when the text doesn't fit.
        while page.insert_textbox(box, text, fontsize=size, fontname="serif", fontfile=SERIF_FONT) < 0 and size > 4:
            page.clean_contents()
            page = replace_page(doc, page)
            size -= 0.5
    doc.set_metadata({"title": meta["title"], "author": " & ".join(meta.get("author") or [])})
    doc.save(dest, garbage=3, deflate=True)
    return len(pages)


def ocr_pdf(src, dest, meta, dpi=300):
    """Copy a scanned PDF, adding an invisible OCR text layer line by line.

    The page images are untouched; the text sits on top in render mode 3
    (invisible), the way OCR'd PDFs from scanners work.
    """
    import pymupdf as fitz

    doc = fitz.open(src)
    for page in doc:
        textpage = page.get_textpage_ocr(flags=0, full=True, dpi=dpi)
        lines = {}
        for x0, y0, x1, y1, word, block, line, _ in page.get_text("words", textpage=textpage):
            lines.setdefault((block, line), []).append((x0, y0, x1, y1, word))
        for words in lines.values():
            x0 = min(w[0] for w in words)
            top = min(w[1] for w in words)
            bottom = max(w[3] for w in words)
            size = max(4.0, (bottom - top) * 0.8)
            page.insert_text((x0, bottom - (bottom - top) * 0.2), " ".join(w[4] for w in words),
                             fontsize=size, fontname="serif", fontfile=SERIF_FONT, render_mode=3)
    doc.set_metadata({**doc.metadata, "title": meta["title"], "author": " & ".join(meta.get("author") or [])})
    doc.save(dest, garbage=3, deflate=True)
    return len(doc)


def replace_page(doc, page):
    """A blank page in place of `page` (a failed insert still draws partial text)."""
    number = page.number
    doc.delete_page(number)
    return doc.new_page(pno=number, width=612, height=792)


# Calibre renders PDFs with QtWebEngine, which needs a display and refuses to
# run as root with its sandbox on (as in CI containers).
CONVERT_ENV = {**os.environ, "QT_QPA_PLATFORM": "offscreen", "QTWEBENGINE_DISABLE_SANDBOX": "1"}


def convert(src, dest, meta):
    cmd = ["ebook-convert", str(src), str(dest), *CONVERT_OPTIONS,
           "--title", meta["title"], "--authors", " & ".join(meta.get("author") or [])]
    result = subprocess.run(cmd, env=CONVERT_ENV, capture_output=True, text=True)
    if result.returncode:
        sys.exit(f"ebook-convert failed on {src.name}:\n{result.stdout[-2000:]}{result.stderr[-2000:]}")


def build(book_id, meta):
    src = ROOT_DIR / meta["source"]
    dest = PDF_DIR / f"{book_id}.pdf"
    ext = src.suffix.lower()
    if ext == ".pdf":
        n = ocr_pdf(src, dest, meta)
        return f"scanned pdf, {n} pages OCR'd"
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        if ext == ".epub":
            marked = tmp / "book.epub"
            n = prepare_epub(src, marked)
            convert(marked, dest, meta)
            return f"epub, {n} print-page markers"
        if ext == ".zip":
            n = zip_pages_to_pdf(src, dest, meta)
            return f"zip, {n} scanned pages"
        convert(src, dest, meta)
        return ext.lstrip(".")


def main():
    manifest = json.loads((PDF_DIR / "manifest.json").read_text())
    wanted = set(sys.argv[1:])
    for book_id, meta in manifest.items():
        if not meta.get("source") or (wanted and book_id not in wanted):
            continue
        print(f"{book_id}: {build(book_id, meta)}", flush=True)


if __name__ == "__main__":
    main()
