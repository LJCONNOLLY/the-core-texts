#!/usr/bin/env python3
"""
talking.py — builds the "Talking to Each Other" cross-reference data.

For every book on the core list, finds every place another author on
the core list is named and pulls the sentence containing the mention plus the
sentence before and after it. Mentions inside the book's endnotes are kept
too, but flagged as being in the notes.

Output: data/talking.json
"""

import json
import re
from pathlib import Path

ROOT_DIR = Path(__file__).parent
DATA_DIR = ROOT_DIR / "data"
BOOKS_DIR = DATA_DIR / "books"
OUT_PATH = DATA_DIR / "talking.json"

# Every book in data/index.json is scanned. The engine works out where the
# notes, bibliographies and indexes are from their headings; these overrides
# cover books whose layout it can't infer. `notes` / `skip` / `body` force a
# locator into that region.
OVERRIDES = {
    "dignazio-data-feminism-strong-ideas": {"notes": [18, 19], "skip": [17, 20, 21]},
    "hayles-how-we-became-posthuman-virtual-bodies-i": {"notes": list(range(57, 68)), "skip": list(range(68, 90))},
    # Latour's endnotes are one EPUB section per note.
    "latour-reassembling-the-social-an-introduction": {"notes": list(range(24, 373)), "notes_label": False},
    "eubanks-automating-inequality-how-high-tech-tool": {"notes": list(range(14, 20)), "skip": list(range(20, 27))},
    "manovich-cultural-analytics": {"skip": [20]},
    "foucault-order-of-things-an-archaeology-of-human": {"skip": [18]},
    "benjamin-race-after-technology": {"notes": list(range(214, 251))},
    "haraway-simians-cyborgs-and-women-the-reinventio": {"notes": list(range(257, 281))},
    # The scanned references and index at the back are unreadable OCR.
    "rose-visual-methodologies-an-introduction-to": {"skip": list(range(282, 305))},
}

# Core-list authors. `given` lists the first names / initials that may precede
# the surname in a full-name mention.
CORE_AUTHORS = [
    ("jr-distributed-blackness-african-american-c", "André Brock Jr.", "Brock", ["André", "Andre", "André L.", "Andre L."]),
    ("vee-coding-literacy-how-computer-programming", "Annette Vee", "Vee", ["Annette"]),
    ("latour-reassembling-the-social-an-introduction", "Bruno Latour", "Latour", ["Bruno"]),
    ("mckinney-information-activism-a-queer-history-of", "Cait McKinney", "McKinney", ["Cait"]),
    ("dignazio-data-feminism-strong-ideas", "Catherine D'Ignazio", "D[’']Ignazio", ["Catherine"]),
    ("dignazio-data-feminism-strong-ideas", "Lauren F. Klein", "Klein", ["Lauren", "Lauren F."]),
    ("steele-digital-black-feminism-critical-cultural", "Catherine Knight Steele", "Steele", ["Catherine", "Catherine Knight", "Knight"]),
    ("haraway-simians-cyborgs-and-women-the-reinventio", "Donna Haraway", "Haraway", ["Donna", "Donna J."]),
    ("losh-bodies-of-information", "Elizabeth Losh", "Losh", ["Elizabeth", "Liz"]),
    ("losh-bodies-of-information", "Jacqueline Wernimont", "Wernimont", ["Jacqueline", "Jacque"]),
    ("rose-visual-methodologies-an-introduction-to", "Gillian Rose", "Rose", ["Gillian"]),
    ("tham-design-thinking-in-technical-communicati", "Jason Chew Kit Tham", "Tham", ["Jason", "Jason Chew Kit", "Kit"]),
    ("drucker-the-digital-humanities-coursebook-an-int", "Johanna Drucker", "Drucker", ["Johanna"]),
    ("gray-intersectional-tech-black-users-in-digit", "Kishonna L. Gray", "Gray", ["Kishonna", "Kishonna L."]),
    ("gonzales-designing-multilingual-experiences-in-te", "Laura Gonzales", "Gonzales", ["Laura"]),
    ("gold-debates-in-the-digital-humanities-2023", "Matthew K. Gold", "Gold", ["Matthew", "Matthew K."]),
    ("manovich-cultural-analytics", "Lev Manovich", "Manovich", ["Lev"]),
    ("nakamura-digitizing-race-visual-cultures-of-the-i", "Lisa Nakamura", "Nakamura", ["Lisa"]),
    ("foucault-order-of-things-an-archaeology-of-human", "Michel Foucault", "Foucault", ["Michel"]),
    ("bailey-misogynoir-transformed-black-womens-digi", "Moya Bailey", "Bailey", ["Moya"]),
    ("hayles-how-we-became-posthuman-virtual-bodies-i", "N. Katherine Hayles", "Hayles", ["N.", "Katherine", "N. Katherine"]),
    ("walton-technical-communication-after-the-social", "Rebecca Walton", "Walton", ["Rebecca"]),
    ("walton-technical-communication-after-the-social", "Kristen Moore", "Moore", ["Kristen", "Kristen R."]),
    ("walton-technical-communication-after-the-social", "Natasha Jones", "Jones", ["Natasha", "Natasha N."]),
    ("risam-new-digital-worlds-postcolonial-digital", "Roopika Risam", "Risam", ["Roopika"]),
    ("benjamin-race-after-technology", "Ruha Benjamin", "Benjamin", ["Ruha"]),
    ("noble-algorithms-of-oppression", "Safiya Umoja Noble", "Noble", ["Safiya", "Safiya Umoja", "Umoja"]),
    ("ahmed-whats-the-use-on-the-uses-of-use", "Sara Ahmed", "Ahmed", ["Sara"]),
    ("jackson-hashtagactivism-networks-of-race-and-gen", "Sarah J. Jackson", "Jackson", ["Sarah", "Sarah J."]),
    ("jackson-hashtagactivism-networks-of-race-and-gen", "Brooke Foucault Welles", "Welles", ["Brooke", "Brooke Foucault", "Foucault"]),
    ("costanzachock-design-justice-community-led-practices-t", "Sasha Costanza-Chock", "Costanza[-–]Chock", ["Sasha"]),
    ("mullaney-your-computer-is-on-fire", "Thomas S. Mullaney", "Mullaney", ["Thomas", "Thomas S.", "Tom"]),
    ("mullaney-your-computer-is-on-fire", "Benjamin Peters", "Peters", ["Benjamin"]),
    ("mullaney-your-computer-is-on-fire", "Mar Hicks", "Hicks", ["Mar"]),
    ("mullaney-your-computer-is-on-fire", "Kavita Philip", "Philip", ["Kavita"]),
    ("eubanks-automating-inequality-how-high-tech-tool", "Virginia Eubanks", "Eubanks", ["Virginia"]),
    ("ong-orality-and-literacy-the-technologizing", "Walter J. Ong", "Ong", ["Walter", "Walter J."]),
    ("chun-updating-to-remain-the-same-habitual-new", "Wendy Hui Kyong Chun", "Chun", ["Wendy", "Wendy Hui Kyong", "Wendy H. K.", "Wendy H.K."]),
]

# ─── Text cleanup ───────────────────────────────────────────────────────────

MARK = "\x00"  # page markers look like \x00L12\x00 and ride along with the text
MARK_RE = re.compile(r"\x00L(\d+)\x00")


def flatten(text):
    """Collapse line-broken prose into one string, dropping bare note markers."""
    text = text.replace("\xad", "")
    text = re.sub(r"(\w)-\n(?=[a-z])", r"\1", text)  # PDF hyphenation
    text = re.sub(r"\n\d{1,3}\n", "\n", text)        # superscript note refs
    text = re.sub(r"\s*\n\s*", " ", text)
    text = re.sub(r"\s+([,.;:?!’”)])", r"\1", text)   # space left before punctuation
    return re.sub(r"[ \t  \xa0]{2,}", " ", text).strip()


ABBREVIATIONS = {
    "e.g", "i.e", "al", "Dr", "Mr", "Mrs", "Ms", "St", "ed", "eds", "vol", "Vol",
    "no", "No", "pp", "p", "cf", "vs", "Jr", "Sr", "etc", "Inc", "Co", "trans",
    "U.S", "Ph.D", "Mt", "Fig", "fig", "ch", "Prof", "rev", "Ed", "Eds", "chap",
}

SENT_END = re.compile(r"[.!?][’”\"')\]]*\s+(?=(?:\x00L\d+\x00)?[“‘\"'(\[]?[A-Z0-9])")


def split_sentences(text):
    """Split into sentences; returns [(sentence, locator_or_None)]."""
    raw, start = [], 0
    for m in SENT_END.finditer(text):
        before = text[start:m.start() + 1]
        word = re.search(r"(\S+)\.$", before.rstrip("’”\"')]"))
        if word:
            w = word.group(1).lstrip("(“‘\"'")
            # Initials ("Lauren F. Klein") and known abbreviations don't end sentences.
            if re.fullmatch(r"[A-Z]", w) or w in ABBREVIATIONS or re.fullmatch(r"(?:[A-Z]\.)+[A-Z]", w):
                continue
        raw.append(text[start:m.end()])
        start = m.end()
    raw.append(text[start:])
    out, loc = [], None
    for chunk in raw:
        marks = MARK_RE.findall(chunk)
        # A sentence belongs to the page it starts on.
        lead = MARK_RE.match(chunk.lstrip())
        if lead:
            loc = int(lead.group(1))
        start_loc = loc
        if marks:
            loc = int(marks[-1])
        s = re.sub(r"\s{2,}", " ", MARK_RE.sub(" ", chunk)).strip()
        if s:
            out.append((s, start_loc))
    return out


SMALL_WORDS = {"a", "an", "the", "of", "for", "and", "or", "to", "in", "on", "at", "by", "with", "as"}


def title_word(word, first):
    """Title-case one word of an ALL-CAPS heading ("OF" -> "of", "“IT’S" -> "“It’s")."""
    low = word.lower()
    if not first and low in SMALL_WORDS:
        return low
    j = next((k for k, c in enumerate(low) if c.isalpha()), 0)
    return low[:j] + low[j:j + 1].upper() + low[j + 1:]


def chapter_label(heading):
    """"2 Collect, Analyze" -> "Chapter 2: Collect, Analyze"."""
    heading = re.sub(r"\s+", " ", heading.replace("\xad", "")).strip()
    if heading.isupper():
        words = heading.split()
        heading = " ".join(title_word(w, i == 0 or words[i - 1][-1] in ".:") for i, w in enumerate(words))
    if re.fullmatch(r"\d{1,2}", heading):
        return f"Chapter {heading}"
    return re.sub(r"^(\d{1,2})\.? (?=\S)", r"Chapter \1: ", heading)

# ─── Book layout ────────────────────────────────────────────────────────────

NOTES_H = re.compile(r"(?i)(end)?notes|notes to (the )?(chapters?|text)")
SKIP_H = re.compile(
    r"(?i)(selected |select )?(references|bibliography|works cited|bibliographic essay)"
    r"|(name |subject |general )?index|(about the |notes on |list of )?contributors"
    r"|about the authors?|figure credits|illustration credits|(more )?praise for.*"
    r"|(also|books|titles) in the series.*|figure descriptions"
    r"|(recommended|suggested|further) readings?"
)
CONTENTS_H = re.compile(r"(?i)(table of )?contents")

CITE_LINE = re.compile(
    r"^\s*\[?\d{1,3}\]?[.\t)]?\s|^[A-Z][^\s,]+(?:\s[A-Z][^\s,]+)?,\s+[A-Z]"
    r"|(?:19|20)\d\d[a-z]?[).,]|https?://|doi|Ibid"
)


def normalize_heading(line):
    """"R E F E R E N C E S" / "References      177" -> "References"."""
    line = re.sub(r"[\d\[\]|\u2003\u2004\t]+", " ", line)
    if re.fullmatch(r"\s*(?:\S\s+){3,}\S\s*", line):  # letter-spaced caps
        line = re.sub(r"(?<=\S) (?=\S)", "", line)
    return re.sub(r"\s+", " ", line).strip().strip(":").strip()


def is_heading(line, pattern):
    return bool(pattern.fullmatch(normalize_heading(line)))


INDEX_LINE = re.compile(r"\d[\d–-]*[,;]?\s*$|\bSee( also)?\b")


def still_in_back_matter(text, state):
    """Does a PDF page continue the notes/bibliography/index the last page was in?"""
    lines = [l for l in text.split("\n") if len(l.strip()) >= 3]
    if len(text) < 800 or not lines:
        return True
    cites = sum(bool(CITE_LINE.search(l) or INDEX_LINE.search(l)) for l in lines) / len(lines)
    if state == "notes" and len(NOTE_START.findall(text)) >= 2:
        return True
    return cites > 0.25


def strip_running_heads(pages):
    """Drop page numbers and repeated running heads from the top/bottom of PDF pages."""
    def key(line):
        return re.sub(r"[\d\[\]|ivxlc\s  ]+", " ", line).strip().lower()

    counts = {}
    for p in pages:
        lines = [l for l in p["text"].split("\n") if l.strip()]
        for l in lines[:3] + lines[-2:]:
            counts[key(l)] = counts.get(key(l), 0) + 1
    out = []
    for p in pages:
        lines = p["text"].split("\n")
        idx = [i for i, l in enumerate(lines) if l.strip()]
        edge = set(idx[:3] + idx[-2:])
        kept = []
        for i, l in enumerate(lines):
            if i in edge and not is_heading(l, NOTES_H) and not is_heading(l, SKIP_H):
                k = key(l)
                if not k or (counts.get(k, 0) >= 3 and len(k) < 90):
                    continue
            kept.append(l)
        out.append({**p, "text": "\n".join(kept)})
    return out


def byline_pattern():
    names = []
    for _, full, surname, given in CORE_AUTHORS:
        for g in given:
            names.append(re.escape(g) + r"\s+" + surname)
    return re.compile(r"(?:" + "|".join(names) + r")")


BYLINE_NAMES = None


def is_byline(line):
    """A standalone line made only of personal names, one of them a core author."""
    global BYLINE_NAMES
    BYLINE_NAMES = BYLINE_NAMES or byline_pattern()
    l = line.strip()
    if not l or len(l.split()) > 9 or l[-1] in ",.;:" and not re.search(r"\b[A-Z]\.$", l):
        return False
    words = l.replace(",", " ").split()
    if not all(w in ("and", "&") or re.fullmatch(r"[A-Z][\w.’'–-]*", w) for w in words):
        return False
    return bool(BYLINE_NAMES.search(l))


def regions(book, cfg):
    """Walk the book in order and yield (kind, locator, text) pieces.

    kind is "body", "notes" or "skip". Headings like "Notes" or "Bibliography"
    switch the region; EPUB sections start fresh, while PDF pages carry the
    region forward until a page stops looking like a list of citations.
    """
    pages = book["pages"]
    paged = pages and pages[0]["locator_type"] == "page"
    if paged:
        pages = strip_running_heads(pages)

    # Front matter: everything up to the table of contents (and its overflow).
    front_end = -1
    limit = max(3, len(pages) * 15 // 100)
    for i, p in enumerate(pages[:limit]):
        first = [l for l in p["text"].split("\n") if l.strip()][:3]
        if any(is_heading(l, CONTENTS_H) for l in first):
            front_end = i
    while front_end >= 0 and front_end + 1 < limit:
        lines = [l for l in pages[front_end + 1]["text"].split("\n") if l.strip()]
        if lines and sum(bool(re.search(r"\s\d{1,3}\s*$", l)) for l in lines) / len(lines) > 0.3:
            front_end += 1
        else:
            break

    state, locked = "body", False
    total = sum(len(p["text"]) for p in pages)
    seen = 0
    for i, p in enumerate(pages):
        loc, text = p["locator"], p["text"]
        if i <= front_end or loc in cfg.get("skip", []):
            yield "skip", loc, text
            continue
        if loc in cfg.get("notes", []):
            yield "notes", loc, text
            continue
        if loc in cfg.get("body", []):
            yield "body", loc, text
            continue
        if not paged:
            state = "body"
        elif state != "body" and not locked and not still_in_back_matter(text, state):
            state = "body"
        buf = []
        for line in text.split("\n"):
            seen += len(line) + 1
            new = ("notes" if is_heading(line, NOTES_H) else
                   "skip" if is_heading(line, SKIP_H) else None)
            if new == "skip" and state == "notes" and not re.search(
                    r"(?i)references|bibliography|works cited|index", line):
                new = None  # a lone title line inside a note, e.g. "Contributors"
            if seen < total * 0.03:
                new = None  # a table of contents listing "Notes", "Index", ...
            if new == "skip" and paged and i > len(pages) * 0.85 and "index" in line.lower():
                locked = True  # the closing index runs to the end of the book
            if locked:
                new = "skip"
            if new and new != state:
                if buf:
                    yield state, loc, "\n".join(buf)
                buf, state = [], new
                continue
            if state == "body" and is_byline(line):
                continue
            buf.append(line)
        if buf:
            yield state, loc, "\n".join(buf)


NOTE_START = re.compile(
    r"(?m)^[ \t]*\[?(\d{1,3})\]?[ \t]*(?:\n[ \t]*)?(?:[.)](?=\s)|\t|(?=\n)|(?=[ ]+[A-Z“\"‘'\[(]))"
)


def looks_like_chapter_heading(line):
    line = line.strip()
    line = re.sub(r"^\d{1,2}\.?\s+", "", line)
    if not line or len(line) > 150 or line[-1] in ".,;:)" or not (line[0].isalpha() or line[0] in "“\"#"):
        return False
    if re.match(r"(?i)(chapter|notes to|introduction|conclusion|epilogue|prologue|preface|part|afterword|coda)\b", line):
        return True
    words = [w for w in re.findall(r"[A-Za-z’']+", line) if len(w) > 3]
    return bool(words) and sum(w[0].isupper() for w in words) / len(words) >= 0.6


def trailing_heading(lines):
    """The chapter heading (possibly wrapped over several lines) ending `lines`."""
    out = []
    for line in reversed(lines[-5:]):
        l = MARK_RE.sub("", line).strip()
        if not l:
            continue
        caps = l.upper() == l and (len(l) >= 3 or re.fullmatch(r"\d+\.?", l))
        if caps or (not out and looks_like_chapter_heading(l)):
            out.insert(0, l)
        else:
            break
    joined = " ".join(out)
    if joined and (looks_like_chapter_heading(joined) or re.match(r"(?i)chapter\b", joined)):
        return joined
    return None


def split_notes(text, heading=None):
    """Split a run of endnotes (with page markers) into numbered notes."""
    notes = []
    if "Return to note reference." in text:
        for n, chunk in enumerate(text.split("Return to note reference."), 1):
            if chunk.strip():
                notes.append({"chapter": heading, "number": n, "text": chunk})
        return notes
    starts, expected = [], 1
    cands = list(NOTE_START.finditer(text))
    for j, m in enumerate(cands):
        num = int(m.group(1))
        # "1. Historical Narratives" right before "1. Samantha Blackmon" is a chapter heading.
        if num == 1 and j + 1 < len(cands) and int(cands[j + 1].group(1)) == 1 \
                and cands[j + 1].start() - m.start() < 300:
            continue
        # The first note may continue a count from an earlier page.
        if num == expected or (num == 1 and starts) or (not starts and m.start() < 200):
            starts.append((m.start(), m.end(), num))
            expected = num + 1
    if not starts:
        return [{"chapter": heading, "number": None, "text": text}]
    chapter = heading
    lead = trailing_heading(text[:starts[0][0]].split("\n"))
    if lead:
        chapter = lead
    for k, (s, e, num) in enumerate(starts):
        end = starts[k + 1][0] if k + 1 < len(starts) else len(text)
        body = text[e:end]
        next_chapter = None
        if k + 1 < len(starts) and starts[k + 1][2] == 1:
            lines = body.rstrip().split("\n")
            next_chapter = trailing_heading(lines[1:])
            if next_chapter:
                # Drop the heading lines from the end of this note.
                n = len(next_chapter.split())
                while lines and n > 0:
                    n -= len(MARK_RE.sub("", lines.pop()).split())
                body = "\n".join(lines)
        # Keep the page marker that precedes the note so it maps to a page.
        marks = MARK_RE.findall(text[:e])
        prefix = f"{MARK}L{marks[-1]}{MARK}" if marks else ""
        label = chapter and chapter_label(chapter)
        if label and NOTES_H.fullmatch(label):
            label = None
        notes.append({"chapter": label, "number": num, "text": prefix + body})
        if next_chapter:
            chapter = next_chapter
    return notes


def section_title(page):
    first = next((l for l in page["text"].split("\n") if l.strip()), "")
    return chapter_label(first)

# ─── Mention detection ──────────────────────────────────────────────────────

NAME_TOKEN = r"(?:[A-Z][a-zé’'-]+|[A-Z]\.)"

NON_NAMES = {
    "As", "See", "Writes", "In", "For", "And", "But", "The", "This", "That", "Like",
    "When", "While", "Though", "Although", "Here", "Also", "Both", "Scholars",
    "Sociologist", "Historian", "Professor", "Philosopher", "Theorist", "Ed", "Ed.",
    "Eds.", "Cf.", "With", "By", "On", "To", "Following", "According", "If", "So",
    "Yet", "Then", "Thus", "Indeed", "Because", "Since", "Rather", "Or", "Of",
    "Where", "What", "How", "Why", "After", "Before", "From", "Scholar", "Dr.",
}

# "Noble 2018", "Benjamin’s (2019)", "Jones, Moore, and Walton 2016", "Jackson et al. 2020"
YEAR_CITE = re.compile(
    r"(?:(?:,\s*|\s+(?:and|&)\s+|,\s+(?:and|&)\s+)[A-Z][\w’'–-]+(?:\s[A-Z][\w’'–-]+)?){0,4}"
    r"(?:\s+et al\.)?[’']?s?\s*,?\s*\(?\[?(?:(?:19|20)\d\d)"
)
ET_AL = re.compile(r"\s+et al\.")
MULTI_AUTHOR_BOOKS = {a[0] for a in CORE_AUTHORS if sum(b[0] == a[0] for b in CORE_AUTHORS) > 1}


class Attestation:
    """Which core authors a book cites by full name, and in which years."""

    def __init__(self, full_text):
        self.text = full_text
        self.cache = {}

    def check(self, author):
        _, full, surname, given = author
        if full in self.cache:
            return self.cache[full]
        firsts = {g.split()[0] for g in given}
        initials = {g[0] for g in given}
        named = any(re.search(rf"\b{re.escape(g)}\s+{surname}\b", self.text) for g in given)
        years, others = set(), set()
        for m in re.finditer(rf"(?<![-–’'\w]){surname},\s+([A-Z][\w.]*)([^\n]{{0,80}})", self.text):
            who, rest = m.group(1), m.group(2)
            ys = set(re.findall(r"\b((?:19|20)\d\d)\b", rest)[:1])
            if who.rstrip(".") in firsts or (len(who.rstrip(".")) == 1 and who[0] in initials):
                named = True
                years |= ys
            else:
                others |= ys
        self.cache[full] = (named, years, others)
        return self.cache[full]


def find_mentions(text, author, last_named, attest):
    """Yield (start, end) spans of genuine mentions of `author` in `text`.

    A mention counts when the surname is preceded by one of the author's given
    names; or it stands alone and the most recent full-name use of that surname
    in the book was this author (so "Jonathan Gray" doesn't count as Kishonna
    Gray); or it's an author–date citation like "(Noble 2018)" and the book
    cites this author, and no one else with that surname in that year.
    """
    book_id, full, surname, given = author
    # Not a first name ("Benjamin Crump") or a reference-list entry ("Noble, Safiya").
    bib = "|".join(re.escape(g.split()[0]) for g in given) + "|" + given[0][0] + r"\."
    pat = re.compile(
        rf"((?:{NAME_TOKEN}\s+){{0,3}})(?<![-–’'\w])({surname})(?![-–\w])"
        rf"(?!\s+(?:[A-Z]\.|[A-Z][a-z]))(?!,\s+(?:{bib}))"
    )
    for m in pat.finditer(text):
        preceding = m.group(1).split()
        # Drop sentence-initial words like "As", "See", "Writes" that aren't names.
        tokens = [t for t in preceding if t not in NON_NAMES]
        key = surname
        if tokens:
            joined = " ".join(tokens)
            match = next((g for g in given if joined == g or joined.endswith(" " + g)), None)
            if match:
                last_named[key] = full
                yield m.start(2) - len(match) - 1, m.end(2)
            else:
                last_named[key] = joined
            continue
        cite = YEAR_CITE.match(text, m.end(2))
        if ET_AL.match(text, m.end(2)) and book_id not in MULTI_AUTHOR_BOOKS and not cite:
            continue  # "Ahmed et al." is rarely the single author named earlier
        if cite:
            named, years, others = attest.check(author)
            year = re.search(r"(?:19|20)\d\d", cite.group(0))
            year = year.group(0) if year else None
            if named and (not others or (year in years and year not in others)):
                last_named[key] = full
                yield m.start(2), m.end(2)
                continue
        if last_named.get(key) == full:
            yield m.start(2), m.end(2)


# A reference-list entry that slipped into the prose: "Gold, Matthew K., and ..."
BIB_START = re.compile(r"(?:Recommended readings\s+)?([A-Z][\w’'–-]+), ((?:[A-Z]\.\s?)+|[A-Z][a-z]+)(?=[,.\s])")


def is_bib_entry(sentence):
    m = BIB_START.match(sentence)
    if not m:
        return False
    for _, _, surname, given in CORE_AUTHORS:
        if re.fullmatch(surname, m.group(1)):
            first = m.group(2).strip()
            if first[0] == given[0][0] and (first.endswith(".") or first in {g.split()[0] for g in given}):
                return True
    return False


def book_targets(book_id, authors_str):
    out = []
    for a in CORE_AUTHORS:
        _, full, surname, given = a
        mine = a[0] == book_id or (
            re.search(rf"\b{surname}\b", authors_str) and given[0].split()[0] in authors_str)
        if not mine:
            out.append(a)
    return out


def build_source(meta):
    book_id = meta["id"]
    cfg = OVERRIDES.get(book_id, {})
    book = json.loads((BOOKS_DIR / f"{book_id}.json").read_text())
    paged = book["pages"][0]["locator_type"] == "page"
    titles = {p["locator"]: section_title(p) for p in book["pages"]}
    targets = book_targets(book_id, " ".join(meta.get("author") or []))
    attest = Attestation("\n".join(p["text"] for p in book["pages"]))
    surnames = re.compile(r"\b(?:" + "|".join(a[2] for a in targets) + r")\b")

    # Merge consecutive pieces of the same kind into runs, marking page starts.
    runs = []
    for kind, loc, text in regions(book, cfg):
        piece = f"{MARK}L{loc}{MARK}" + text
        if runs and runs[-1][0] == kind and (paged or kind == "notes" or runs[-1][1] == loc):
            runs[-1][2].append(piece)
        else:
            runs.append([kind, loc, [piece]])

    units = []  # (location template, run locator, [(sentence, locator)])
    for kind, loc, pieces in runs:
        text = "\n".join(pieces)
        if kind == "body":
            label = None if paged else titles[loc]
            units.append(({"in_notes": False, "section": label}, loc, split_sentences(flatten(text))))
        elif kind == "notes":
            heading = None if paged or cfg.get("notes_label") is False else titles[loc]
            if heading and NOTES_H.fullmatch(heading):
                heading = None
            for n in split_notes(text, heading):
                units.append(({"in_notes": True, "section": n["chapter"], "note": n["number"]}, loc,
                              split_sentences(flatten(n["text"]))))

    mentions, last_named, seen = [], {}, set()
    for loc, run_loc, sents in units:
        for i, (s, page) in enumerate(sents):
            page = page or run_loc
            if not surnames.search(s) or is_bib_entry(s):
                continue
            for author in targets:
                hits = list(find_mentions(s, author, last_named, attest))
                if not hits or (author[1], s) in seen:
                    continue
                seen.add((author[1], s))
                mentions.append({
                    "bookId": author[0],
                    "author": author[1],
                    **loc,
                    "section": loc["section"] or (f"Page {page}" if page and paged else None),
                    "locator": page,
                    "before": sents[i - 1][0] if i > 0 else "",
                    "sentence": s,
                    "after": sents[i + 1][0] if i + 1 < len(sents) else "",
                    "highlights": [s[a:b] for a, b in hits],
                })
    return {"title": meta["title"], "authors": meta.get("author") or [], "mentions": mentions}


def main():
    index = json.loads((DATA_DIR / "index.json").read_text())
    books = sorted(index["books"], key=lambda b: b["title"].lstrip("#").lower())
    out = {"sources": {}}
    for meta in books:
        src = build_source(meta)
        out["sources"][meta["id"]] = src
        notes = sum(m["in_notes"] for m in src["mentions"])
        print(f"{meta['id']}: {len(src['mentions'])} mentions ({notes} in notes)")
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
