"""
layout.py — recovers headings and paragraphs from a PDF's page layout.

PDF text comes out one printed line at a time, so paragraph breaks and
headings have to be rebuilt. Plain text isn't enough to do that reliably;
the layout is: font size and weight, where each line starts and ends, and
the space between lines. For each book this module learns the body text's
size, margins, indent and line spacing, then turns every page into blocks:

    {"t": "h2" | "h3" | "p" | "q" | "s" | "c", "x": text, "cont": bool}

    h2 / h3  headings (chapter-level / section-level)
    p        paragraph        q  block quote
    s        small print (footnotes, captions)
    c        a centered line that isn't a heading (epigraph credits, dingbats)
    cont     the paragraph carries on from the previous page

Running heads and page numbers are dropped, words hyphenated only because
they broke across a line are rejoined, superscript note numbers become
Unicode superscripts, and to_pdf.py's "[p. 47]" print-page markers become
"{{p. 47}}" tokens for the reader to show in place.
"""

import re
from collections import Counter

PRINT_MARK = re.compile(r"\[p\. ([0-9]+|[ivxlcdm]+)\]", re.IGNORECASE)
PRINT_TOKEN = re.compile(r"\{\{p\. [^}]+\}\}")
SUPERSCRIPT = str.maketrans("0123456789abcdefghijklmnopqrstuvwxyz*†‡",
                            "⁰¹²³⁴⁵⁶⁷⁸⁹ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖqʳˢᵗᵘᵛʷˣʸᶻ*†‡")
SENTENCE_END = re.compile(r"[.?!:;\"”’)\]…]$")
BULLET = re.compile(r"^[•●▪■◦]\s")
# "Figure 3.1", "Table 5.4 Strategies ...", "Plate 2": a caption, not a heading
CAPTION = re.compile(r"(?i)(figure|fig\.|table|plate|image)\s+[\dIVX]+(\.\d+)?[a-z]?\b")


def _round(v, q=0.5):
    return round(v / q) * q


# ─── Reading lines ──────────────────────────────────────────────────────────

def read_lines(page):
    """The page's text lines with their geometry and dominant style.

    Pages printed sideways (landscape tables) are turned upright, so their
    lines read top to bottom like any other page's.
    """
    lines = []
    raw = [l for b in page.get_text("rawdict")["blocks"] for l in b.get("lines", [])]
    for line in raw:
        for s in line["spans"]:
            # Some PDFs put zero-width spaces at hyphenation points ("be hav ior").
            # They take up no room: the next letter starts where the space does.
            chars = s["chars"]
            s["text"] = "".join(
                c["c"] for i, c in enumerate(chars)
                if c["c"] != " " or i + 1 == len(chars)
                or chars[i + 1]["bbox"][0] - c["bbox"][0] > 0.03 * s["size"])
    turned = sum(len(s["text"]) for l in raw if abs(l["dir"][0]) < 0.5 for s in l["spans"])
    sideways = turned > 0.5 * sum(len(s["text"]) for l in raw for s in l["spans"])
    W, H = page.rect.width, page.rect.height
    for line in raw:
        spans = [s for s in line["spans"] if s["text"].strip()]
        if not spans:
            continue
        main = max(spans, key=lambda s: len(s["text"].strip()))
        size = main["size"]
        base = main["origin"][1]
        parts = []
        for s in line["spans"]:
            t = s["text"]
            # A small span sitting above the baseline is a note reference.
            raised = s["size"] < size * 0.82 and s["origin"][1] < base - size * 0.15
            if raised and re.fullmatch(r"\s*[0-9a-z*†‡,–-]{1,6}\s*", t):
                t = t.strip().translate(SUPERSCRIPT)
            parts.append(t)
        text = re.sub(r"\s+", " ", "".join(parts)).strip()
        # Keep a soft hyphen at the line's end (the word goes on below).
        text = text.rstrip("\xad").replace("\xad", "") + ("\xad" if text.endswith("\xad") else "")
        if not text:
            continue
        bold = all(s["flags"] & 16 or "Bold" in s["font"] or "Black" in s["font"]
                   for s in spans if s["text"].strip())
        x0, y0, x1, y1 = line["bbox"]
        if sideways:
            if line["dir"][1] < 0:  # reads upward
                x0, y0, x1, y1 = H - y1, x0, H - y0, x1
            else:                   # reads downward
                x0, y0, x1, y1 = y0, W - x1, y1, W - x0
        lines.append({"x0": x0, "x1": x1, "y0": y0, "y1": y1, "size": size,
                      "bold": bold, "text": text})
    if sideways or single_column(lines):
        # Top to bottom (a PDF may store a caption or heading after the text).
        lines.sort(key=lambda l: (round(l["y0"]), l["x0"]))
        lines = merge_fragments(lines)
    return lines


def merge_fragments(lines):
    """Rejoin pieces of one printed line that the PDF stores separately
    (scanned books' text layers split lines into word groups)."""
    rows = []
    for l in lines:
        mid = (l["y0"] + l["y1"]) / 2
        row = next((r for r in rows[-3:] if abs((r[0]["y0"] + r[0]["y1"]) / 2 - mid) < 0.45 * l["size"]), None)
        if row is not None:
            row.append(l)
        else:
            rows.append([l])
    out = []
    for row in rows:
        row.sort(key=lambda l: l["x0"])
        cur = row[0]
        for l in row[1:]:
            if -2 <= l["x0"] - cur["x1"] < 1.6 * max(l["size"], cur["size"]) and not PRINT_MARK.fullmatch(l["text"]):
                big = cur if len(cur["text"]) >= len(l["text"]) else l
                cur = {**cur, "x1": l["x1"], "y0": min(cur["y0"], l["y0"]), "y1": max(cur["y1"], l["y1"]),
                       "size": big["size"], "bold": cur["bold"] and l["bold"],
                       "text": cur["text"] + ("" if cur["text"].endswith("\xad") else " ") + l["text"]}
            else:
                out.append(cur)
                cur = l
        out.append(cur)
    return out


def single_column(lines):
    """No two lines side by side with a gutter between them (like an index)."""
    side = 0
    for a in lines:
        for b in lines:
            if b["x0"] > a["x1"] + 12 and min(a["y1"], b["y1"]) - max(a["y0"], b["y0"]) > 0.5 * a["size"] \
                    and a["x1"] - a["x0"] > 120 and b["x1"] - b["x0"] > 120:
                side += 1
    return side < 3


def book_profile(all_lines):
    """Body size and typical line spacing across the whole book."""
    sizes = Counter()
    for lines in all_lines:
        for l in lines:
            sizes[_round(l["size"])] += len(l["text"])
    body = sizes.most_common(1)[0][0] if sizes else 10.0
    gaps = Counter()
    for lines in all_lines:
        for a, b in zip(lines, lines[1:]):
            if abs(a["size"] - body) < 0.6 and abs(b["size"] - body) < 0.6:
                g = b["y0"] - a["y0"]
                if 0.8 * body < g < 2.5 * body:
                    gaps[_round(g, 0.25)] += 1
    step = gaps.most_common(1)[0][0] if gaps else body * 1.2
    # Scanned books' text layers give every line a slightly different size.
    spreads = []
    for lines in all_lines:
        sz = sorted(l["size"] for l in lines if len(l["text"]) > 30)
        if len(sz) >= 8:
            spreads.append((sz[len(sz) * 3 // 4] - sz[len(sz) // 4]) / sz[len(sz) // 2])
    noisy = bool(spreads) and sorted(spreads)[len(spreads) // 2] > 0.03
    return {"body": body, "step": step, "noisy": noisy}


def running_heads(all_lines, heights):
    """Keys of lines repeated at the top or bottom of many pages."""
    counts = Counter()
    for lines, h in zip(all_lines, heights):
        for l in lines:
            if l["y0"] < h * 0.1 or l["y1"] > h * 0.9:
                counts[_edge_key(l["text"])] += 1
    return {k for k, c in counts.items() if c >= 3 and k}


def _edge_key(text):
    return re.sub(r"[\d\s\[\]|ivxlc.]+", " ", text.lower()).strip()


# ─── Building blocks ────────────────────────────────────────────────────────

def page_blocks(lines, profile, heads, height, vocab, chapter_start=None, ragged=False):
    """Blocks for one page. `chapter_start` says whether the PDF's bookmarks
    put a chapter's start here (None when the book has no bookmarks).
    `ragged`: line spacing and indents mean nothing (Haraway's OCR text), so
    only a short line ending a sentence closes a paragraph."""
    body, step = profile["body"], profile["step"]
    # How far a size must stray from the body's to mean something
    big2, big3, small_at, num_at = (1.6, 1.3, 0.75, 1.3) if profile["noisy"] else (1.35, 1.12, 0.9, 1.1)

    # Drop running heads, page numbers and blank print-page-only lines.
    kept = []
    for i, l in enumerate(lines):
        # In the top or bottom margin, or set apart as the page's first/last line
        edge = l["y0"] < height * 0.1 or l["y1"] > height * 0.9 \
            or i == 0 and len(lines) > 1 and lines[1]["y0"] - l["y0"] > 1.8 * step \
            or i == len(lines) - 1 and i > 0 and l["y0"] - lines[i - 1]["y0"] > 1.8 * step
        # (A large number at the top is a chapter number, not a page number.)
        top_big = l["y0"] < height * 0.5 and l["size"] > body * num_at
        if edge and not top_big and (re.fullmatch(r"[\divxlc\s.|\[\]–-]{1,12}", l["text"], re.I)
                                     or _edge_key(l["text"]) in heads):
            continue
        kept.append(l)
    lines = attach_bullets(attach_print_marks(kept))
    if not lines:
        return []

    prose = [l for l in lines if abs(l["size"] - body) < 0.6 and len(l["text"]) > 25] or lines
    # The margin is the leftmost x that many lines start at (not the most
    # common one: in hanging-indent notes most lines are the indented ones).
    starts = Counter(_round(l["x0"], 1) for l in prose)
    left = min(x for x, c in starts.items() if c >= max(2, 0.15 * len(prose)) or c == max(starts.values()))
    right = sorted(l["x1"] for l in prose)[int(len(prose) * 0.9) - 1 if len(prose) > 1 else 0]
    full = [l for l in prose if l["x1"] >= right - body]
    justified = len(full) >= 0.5 * len(prose) and len(prose) >= 4
    # Hanging indents (bibliographies, notes): an indented line there continues
    # the full-width line above it mid-sentence; in prose it starts a paragraph
    # after a line that ended one.
    carried = starts_para = 0
    for a, b in zip(lines, lines[1:]):
        if 0.6 * body <= b["x0"] - left <= 4 * body and b["x1"] >= right - body:
            if abs(a["x0"] - b["x0"]) < 0.3 * body or \
                    a["x1"] >= right - body and not SENTENCE_END.search(a["text"]) and a["x0"] - left < 0.3 * body:
                carried += 1
            else:
                starts_para += 1
    hang = carried >= 2 and carried > starts_para
    mid = (left + right) / 2

    def level(l):
        return l["x0"] - left

    def centered(l):
        # (Short lines only: a block quote is indented evenly on both sides too.)
        return (level(l) > 2 * body and right - l["x1"] > 2 * body
                and l["x1"] - l["x0"] < 0.72 * (right - left)
                and abs((l["x0"] + l["x1"]) / 2 - mid) < 1.5 * body)

    def heading_style(l):
        words = l["text"].split()
        if CAPTION.match(l["text"]):
            return None
        if len(words) > 18 or len(l["text"]) > 140:
            return None
        if l["size"] >= body * big2:
            return "h2"
        if l["size"] >= body * big3:
            return "h3"
        if l["bold"] and not SENTENCE_END.search(l["text"]) and len(words) <= 14:
            return "h3"
        letters = re.sub(r"[^A-Za-z]", "", l["text"])
        if len(letters) >= 4 and letters.isupper() and not l["text"].startswith(("—", "–")) and len(words) <= 12 and not SENTENCE_END.search(l["text"]):
            return "h3"
        return None

    tables = table_regions(lines, body)

    blocks, cur = [], None

    def close():
        nonlocal cur
        if cur:
            blocks.append(cur)
        cur = None

    prev = None
    done_tables = set()
    for l in lines:
        region = next((i for i, (top, bottom, _) in enumerate(tables) if top <= l["y0"] <= bottom), None)
        if region is not None:
            if region not in done_tables:
                close()
                done_tables.add(region)
                blocks.append({"t": "t", "rows": tables[region][2], "lines": [l]})
            prev = l
            continue
        style = heading_style(l)
        small = l["size"] < body * small_at and not style or bool(CAPTION.match(l["text"]))
        gap = l["y0"] - prev["y0"] if prev else 0
        spaced = prev is not None and gap > max(step * 1.45, step + 0.45 * body) and not ragged
        text = l["text"]

        if style:
            same = (cur and cur["t"] == style and prev is not None
                    and gap < max(l["size"], prev["size"]) * 2.2)
            if same:
                cur["lines"].append(l)
            else:
                close()
                cur = {"t": style, "lines": [l]}
            prev = l
            continue

        kind = "s" if small else "p"
        new = cur is None or cur["t"] not in ("p", "q", "s", "c") or spaced
        if not new and cur["t"] != kind and not (cur["t"] == "q" and kind == "p"):
            new = True
        if not new:
            last = cur["lines"][-1]
            ind, last_ind = level(l), level(last)
            if ragged:
                new = last["x1"] < right - 4 * body and bool(SENTENCE_END.search(last["text"]))
            elif hang:
                new = ind < 0.3 * body  # each entry starts back at the margin
            elif BULLET.match(cur["lines"][0]["text"]) and l["x0"] > cur["lines"][0]["x0"] + 0.3 * body:
                new = False  # a bullet item wrapping under its own text
            else:
                # Indent starts a paragraph; a run of equally indented lines is a quote.
                if 0.6 * body <= ind - last_ind <= 4 * body and not centered(l):
                    new = True
                elif cur["t"] == "q" and ind < 0.6 * body:
                    new = True
                elif justified and last["x1"] < right - 1.5 * body and not PRINT_MARK.search(last["text"]) \
                        and SENTENCE_END.search(last["text"]) and not text[:1].islower():
                    new = True  # the short last line of a paragraph (a floated marker shortens lines too)
            if BULLET.match(text) or centered(l) != centered(last):
                new = True
        if new:
            close()
            t = "c" if centered(l) and not small else kind
            cur = {"t": t, "lines": [l]}
        else:
            cur["lines"].append(l)
        prev = l
    close()

    out = []
    for b in blocks:
        ls = b["lines"]
        t = b["t"]
        if t == "t":
            out.append({"t": "t", "x": "\n".join("\t".join(r) for r in b["rows"]),
                        "top": ls[0]["y0"], "first": ls[0], "last": ls[-1]})
            continue
        if t == "p" and len(ls) >= 2 and all(level(x) >= 1.2 * body for x in ls) \
                and any(right - x["x1"] > 1.2 * body for x in ls[:-1]):
            t = "q"  # indented on both sides
        text = join_lines([x["text"] for x in ls], vocab)
        if t in ("h2", "h3") and re.fullmatch(r"(\S{1,3} ){3,}\S{1,3}", text):
            text = text.replace(" ", "")  # letter-spaced caps: "P R E FAC E"
        out.append({"t": t, "x": text, "top": ls[0]["y0"], "first": ls[0], "last": ls[-1]})

    # A heading that is only a chapter number ("2", "Chapter 2") joins the
    # title after it.
    merged = []
    for b in out:
        prev_h = merged[-1] if merged else None
        if prev_h and prev_h["t"] in ("h2", "h3") and b["t"] in ("h2", "h3") and \
                re.fullmatch(r"(?i)((chapter|part)\s+)?[\divxlc]+\.?|(chapter|part)\s+\w+",
                             PRINT_TOKEN.sub("", prev_h["x"]).strip()):
            prev_h["x"] = prev_h["x"] + " " + b["x"]
            prev_h["t"] = min(prev_h["t"], b["t"])
            prev_h["last"] = b["last"]
            continue
        merged.append(b)
    out = merged

    # Heading levels: with bookmarks, the first heading where a chapter starts
    # is the chapter title and the rest are sections; without, size decides.
    if chapter_start is not None:
        first = True
        for b in out:
            if b["t"] in ("h2", "h3"):
                b["t"] = "h2" if chapter_start and first else "h3"
                first = False

    # Small type with body text after it is a block quote set small, not a
    # footnote (those sit at the foot of the page).
    for i, b in enumerate(out):
        if b["t"] == "s" and len(b["x"].split()) >= 25 and any(o["t"] == "p" for o in out[i + 1:]):
            b["t"] = "q"

    # A short standalone line in title case, set off by space, is a heading
    # in books that don't style headings differently (Haraway's plain text).
    for i, b in enumerate(out):
        if b["t"] in ("p", "c") and _looks_like_title(b["x"]) and b["first"] is b["last"]:
            before = i == 0 or b["top"] - out[i - 1]["last"]["y0"] > step * 1.45
            after = i == len(out) - 1 or out[i + 1]["top"] - b["last"]["y0"] > step * 1.45
            if before and after:
                b["t"] = "h3"

    # Does the page's first paragraph carry on from the previous page? (Only
    # figures and captions may come before it.)
    for b in out:
        if b["t"] in ("h2", "h3"):
            break
        if b["t"] in ("p", "q"):
            f = b["first"]
            b["cont"] = level(f) >= 0.3 * body if hang else \
                level(f) < 0.6 * body or f["text"][:1].islower()
            break

    return [{k: v for k, v in b.items() if k in ("t", "x", "cont") and (k != "cont" or v)}
            for b in out]


def attach_print_marks(lines):
    """Put each floated "[p. 47]" marker at the end of the line it sits beside."""
    marks = [l for l in lines if PRINT_MARK.fullmatch(l["text"])]
    rest = [l for l in lines if not PRINT_MARK.fullmatch(l["text"])]
    for m in marks:
        beside = [l for l in rest if min(l["y1"], m["y1"]) - max(l["y0"], m["y0"]) > 0]
        above = [l for l in rest if l["y0"] <= m["y0"]]
        target = max(beside, key=lambda l: l["x1"]) if beside else (above[-1] if above else None)
        if target is not None:
            i = rest.index(target)
            rest[i] = {**target, "text": target["text"] + " " + m["text"]}
    return rest


def attach_bullets(lines):
    """Join a bullet that PDF text keeps as its own line to the text beside it."""
    out, skip = [], set()
    for i, l in enumerate(lines):
        if i in skip:
            continue
        t = l["text"]
        if t.endswith(" •"):  # a bullet that trailed the line above
            l = {**l, "text": t[:-2]}
            if i + 1 < len(lines) and lines[i + 1]["text"] != "•":
                lines[i + 1] = {**lines[i + 1], "text": "• " + lines[i + 1]["text"]}
        if l["text"] in "•●▪■◦" and l["text"]:
            j = next((j for j in range(i + 1, min(i + 4, len(lines)))
                      if abs(lines[j]["y0"] - l["y0"]) < 0.6 * l["size"] and lines[j]["x0"] > l["x0"]), None)
            if j is not None:
                skip.add(j)
                l = {**lines[j], "x0": l["x0"], "text": "• " + lines[j]["text"]}
        out.append(l)
    return out


def table_regions(lines, body):
    """Vertical spans of the page laid out as a table, with their rows.

    A table row is text sitting side by side on one baseline, separated by
    wide gaps; two or more such rows close together make a table, and every
    line between them (a wrapped cell) belongs to it.
    """
    rows = []
    for l in sorted(lines, key=lambda l: (l["y0"], l["x0"])):
        if rows and abs(rows[-1][0]["y0"] - l["y0"]) < 0.4 * l["size"]:
            rows[-1].append(l)
        else:
            rows.append([l])
    multi = []
    for r in rows:
        r.sort(key=lambda l: l["x0"])
        if len(r) >= 2 and all(b["x0"] - a["x1"] > 1.2 * body for a, b in zip(r, r[1:])):
            multi.append(r)
    regions = []
    for r in multi:
        top = r[0]["y0"]
        if regions and top - regions[-1][1] < 6 * body:
            regions[-1][1] = top
        else:
            regions.append([top, top])
    # Extend down through short trailing rows (the last row's wrapped cells).
    width = max((l["x1"] for l in lines), default=0) - min((l["x0"] for l in lines), default=0)
    for reg in regions:
        for r in rows:
            if reg[1] < r[0]["y0"] <= reg[1] + 2.2 * body and \
                    (len(r) >= 2 or r[0]["x1"] - r[0]["x0"] < 0.4 * width):
                reg[1] = r[0]["y0"]
    out = []
    for top, bottom in regions:
        inside = [r for r in rows if top <= r[0]["y0"] <= bottom]
        if sum(len(r) >= 2 for r in inside) >= 2:
            out.append((top - 0.1, bottom + 0.1, [[c["text"] for c in r] for r in inside]))
    return out


def _looks_like_title(text):
    words = text.split()
    if not 1 <= len(words) <= 10 or SENTENCE_END.search(text) or len(text) > 90:
        return False
    long = [w for w in re.findall(r"[A-Za-z’']+", text) if len(w) > 3]
    return bool(long) and sum(w[0].isupper() for w in long) / len(long) >= 0.75


def join_lines(texts, vocab):
    """Join a paragraph's lines, rejoining words hyphenated only by the line break."""
    out = ""
    for t in texts:
        if not out:
            out = t
            continue
        if out.endswith("\xad"):
            out = out[:-1] + t
            continue
        m = re.search(r"(\w+)-$", out)
        n = re.match(r"([a-z]\w*)", t)
        if m and n:
            whole = (m.group(1) + n.group(1)).lower()
            if (whole in vocab or known_word(whole)) and f"{m.group(1)}-{n.group(1)}".lower() not in vocab:
                out = out[:-1] + t
                continue
            out = out + t  # a real hyphen ("ethnicity-based")
            continue
        out = out + " " + t
    out = out.replace("\xad", "")
    return PRINT_MARK.sub(lambda m: "{{p. " + m.group(1) + "}}", out)


_speller = None


def known_word(word):
    """A dictionary word, for line-break hyphens in words the book never
    prints whole ("func-tioning")."""
    global _speller
    if _speller is None:
        try:
            from spellchecker import SpellChecker
            _speller = SpellChecker()
        except ImportError:
            return False
    return word in _speller


def book_vocab(all_lines):
    """Words the book uses whole, to tell line-break hyphens from real ones."""
    vocab = Counter()
    for lines in all_lines:
        for l in lines:
            for w in re.findall(r"[A-Za-z][A-Za-z-]*[A-Za-z]", l["text"]):
                vocab[w.lower()] += 1
    return vocab


def book_blocks(doc, chapter_pages=None, ragged=False):
    """Blocks for every page of a PyMuPDF document, keyed by 1-based page number.
    `chapter_pages`: pages where the bookmarks start a chapter, if it has any."""
    all_lines = [read_lines(p) for p in doc]
    heights = [p.rect.width if lines and max(l["x1"] for l in lines) > p.rect.width + 1 else p.rect.height
               for p, lines in zip(doc, all_lines)]
    profile = book_profile(all_lines)
    heads = running_heads(all_lines, heights)
    vocab = book_vocab(all_lines)
    return {i + 1: page_blocks(lines, profile, heads, h, vocab,
                               None if chapter_pages is None else i + 1 in chapter_pages, ragged)
            for i, (lines, h) in enumerate(zip(all_lines, heights))}
