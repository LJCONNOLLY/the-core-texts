#!/usr/bin/env python3
"""
talking.py — builds the "Talking to Each Other" cross-reference data.

For every book on the core list, finds every place another author on
the core list is named and pulls the sentence containing the mention plus the
sentence before and after it. Only the main text counts: endnotes, front
matter, acknowledgments, bibliographies and indexes are left out.

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
# PDF page into that region.
OVERRIDES = {
    # Notes set as bare lines ("Toye 2016.") under "Notes to pages 5-11" heads
    "benjamin-race-after-technology": {"notes": list(range(214, 251))},
    "haraway-simians-cyborgs-and-women-the-reinventio": {"notes": list(range(257, 281))},
    # Acknowledgments whose heading didn't survive into the PDF's text
    "nakamura-digitizing-race-visual-cultures-of-the-i": {"skip": [8, 9, 10]},
}

# Core-list authors. `given` lists the first names / initials that may precede
# the surname in a full-name mention, including misspellings the books use
# ("Michael Foucault", "Kristin Moore").
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
    ("drucker-the-digital-humanities-coursebook-an-int", "Johanna Drucker", "Drucker", ["Johanna", "Johannah"]),
    ("gray-intersectional-tech-black-users-in-digit", "Kishonna L. Gray", "Gray", ["Kishonna", "Kishonna L."]),
    ("gonzales-designing-multilingual-experiences-in-te", "Laura Gonzales", "Gonzales", ["Laura"]),
    ("gold-debates-in-the-digital-humanities-2023", "Matthew K. Gold", "Gold", ["Matthew", "Matthew K.", "Mathew", "Matt"]),
    ("manovich-cultural-analytics", "Lev Manovich", "Manovich", ["Lev"]),
    ("nakamura-digitizing-race-visual-cultures-of-the-i", "Lisa Nakamura", "Nakamura", ["Lisa"]),
    ("foucault-order-of-things-an-archaeology-of-human", "Michel Foucault", "Foucault", ["Michel", "Michael", "Mickel"]),
    ("bailey-misogynoir-transformed-black-womens-digi", "Moya Bailey", "Bailey", ["Moya"]),
    ("hayles-how-we-became-posthuman-virtual-bodies-i", "N. Katherine Hayles", "Hayles", ["N.", "Katherine", "N. Katherine"]),
    ("walton-technical-communication-after-the-social", "Rebecca Walton", "Walton", ["Rebecca"]),
    ("walton-technical-communication-after-the-social", "Kristen Moore", "Moore", ["Kristen", "Kristen R.", "Kristin"]),
    ("walton-technical-communication-after-the-social", "Natasha Jones", "Jones", ["Natasha", "Natasha N."]),
    ("risam-new-digital-worlds-postcolonial-digital", "Roopika Risam", "Risam", ["Roopika"]),
    ("benjamin-race-after-technology", "Ruha Benjamin", "Benjamin", ["Ruha"]),
    ("noble-algorithms-of-oppression", "Safiya Umoja Noble", "Noble", ["Safiya", "Safiya Umoja", "Umoja", "Safya"]),
    ("ahmed-whats-the-use-on-the-uses-of-use", "Sara Ahmed", "Ahmed", ["Sara", "Sarah"]),
    ("jackson-hashtagactivism-networks-of-race-and-gen", "Sarah J. Jackson", "Jackson", ["Sarah", "Sarah J."]),
    ("jackson-hashtagactivism-networks-of-race-and-gen", "Brooke Foucault Welles", "Welles", ["Brooke", "Brooke Foucault", "Foucault", "Foucalt", "Brooke Foucalt"]),
    ("costanzachock-design-justice-community-led-practices-t", "Sasha Costanza-Chock", "Costanza[-–]Chock", ["Sasha"]),
    ("mullaney-your-computer-is-on-fire", "Thomas S. Mullaney", "Mullaney", ["Thomas", "Thomas S.", "Tom"]),
    ("mullaney-your-computer-is-on-fire", "Benjamin Peters", "Peters", ["Benjamin", "Ben"]),
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
    text = re.sub(r"([.!?”’\")])\d{1,3}(?=\s)", r"\1", text)  # ...as in "primary.97 N. Katherine"
    text = re.sub(r"\s*\n\s*", " ", text)
    text = re.sub(r"\s+([,.;:?!’”)])", r"\1", text)   # space left before punctuation
    return re.sub(r"[ \t  \xa0]{2,}", " ", text).strip()


ABBREVIATIONS = {
    "e.g", "i.e", "al", "Dr", "Mr", "Mrs", "Ms", "St", "ed", "eds", "vol", "Vol",
    "no", "No", "pp", "p", "cf", "vs", "Jr", "Sr", "etc", "Inc", "Co", "trans",
    "U.S", "Ph.D", "Mt", "Fig", "fig", "ch", "Prof", "rev", "Ed", "Eds", "chap",
}

SENT_END = re.compile(r"[.!?][’”\"')\]]*\s+(?=(?:\x00L\d+\x00\s*)?[“‘\"'(\[]?[A-Z0-9])")


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

NOTES_H = re.compile(r"(?i)(end|foot)?notes|notes to (the )?(chapters?|text)")
SKIP_H = re.compile(
    r"(?i)(selected |select )?(references|bibliography|works cited|bibliographic essay)"
    r"|(name |subject |general )?index|(about the |notes on |list of )?contributors"
    r"|about the authors?|figure credits|illustration credits|(more )?praise for.*"
    r"|(also|books|titles) in the series.*|figure descriptions"
    r"|(recommended|suggested|further) readings?"
)
CONTENTS_H = re.compile(r"(?i)(table of )?contents")
ACK_H = re.compile(r"(?i)acknowledge?ments?")
# Headings that end an acknowledgments section
CHAPTER_H = re.compile(
    r"(?i)(introduction|preface|foreword|prologue|contents|conclusion|epilogue|afterword)\b.{0,80}"
    r"|(chapter|part)\s+\w+.{0,80}|\d{1,2}\.?\s+[A-Z“\"].{0,80}"
)

CITE_LINE = re.compile(
    r"^\s*\[?\d{1,3}\]?[.\t)]?\s|^[A-Z][^\s,]+(?:\s[A-Z][^\s,]+)?,\s+[A-Z]"
    r"|(?:19|20)\d\d[a-z]?[).,]|https?://|doi|Ibid"
)


def normalize_heading(line):
    """"R E F E R E N C E S" / "References      177" -> "References"."""
    line = re.sub(r"[\d\[\]|\u2003\u2004\t]+", " ", line.replace("\xad", ""))
    words = line.split()
    # Letter-spaced caps, even unevenly ("AC K N OW L E D G M E N T S")
    if len(words) >= 4 and all(len(w) <= 3 for w in words):
        line = "".join(words)
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
            if i in edge and not any(is_heading(l, h) for h in (NOTES_H, SKIP_H, ACK_H)):
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
    switch the region, which carries forward page to page until a page stops
    looking like a list of citations. An "Acknowledgments" heading starts an
    "ack" region that lasts until the next chapter-level heading.
    """
    pages = strip_running_heads(book["pages"])
    bookmarked = bookmarked_regions(book)

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
        if loc in bookmarked:
            yield bookmarked[loc], loc, text
            continue
        if state not in ("body", "ack") and not locked and not still_in_back_matter(text, state):
            state = "body"
        buf = []
        for line in text.split("\n"):
            seen += len(line) + 1
            new = ("notes" if is_heading(line, NOTES_H) else
                   "skip" if is_heading(line, SKIP_H) else
                   "ack" if is_heading(line, ACK_H) else
                   "body" if state == "ack" and (CHAPTER_H.fullmatch(line.strip())
                                                 or is_heading(line, CHAPTER_H)) else None)
            if new == "skip" and state == "notes" and not re.search(
                    r"(?i)references|bibliography|works cited|index", line):
                new = None  # a lone title line inside a note, e.g. "Contributors"
            if seen < total * 0.03 and new in ("notes", "skip"):
                new = None  # a table of contents listing "Notes", "Index", ...
            if new == "skip" and i > len(pages) * 0.85 and "index" in line.lower():
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


def bookmarked_regions(book):
    """PDF page -> "notes", "skip" or "ack" for pages under a top-level bookmark
    named like "Notes", "Bibliography" or "Acknowledgments" (the PDF's own map
    of its front and back matter)."""
    marks = sorted((e["section"], e["title"]) for e in book.get("toc", [])
                   if e.get("level", 0) == 0 and e.get("section"))
    out = {}
    for (start, title), (end, _) in zip(marks, marks[1:] + [(10 ** 6, None)]):
        kind = ("notes" if is_heading(title, NOTES_H) else
                "skip" if is_heading(title, SKIP_H) else
                "ack" if re.match(r"(?i)acknowledge?ments?\b", title.strip()) else None)
        if kind:
            for p in book["pages"]:
                if start <= p["locator"] < end:
                    out[p["locator"]] = kind
    return out


NOTE_START = re.compile(
    r"(?m)^[ \t]*\[?(\d{1,3})\]?[ \t]*(?:\n[ \t]*)?(?:[.)](?=\s)|\t|(?=\n)|(?=[ ]+[A-Z“\"‘'\[(]))"
)


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
    """Which core authors a book cites by full name, and in which years; and
    whether anyone else in the book shares their surname."""

    def __init__(self, full_text, chapters=None):
        self.text = full_text
        self.chapters = chapters or {}  # chapter title -> its pages' raw text
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
            elif who not in NON_NAMES and who not in {"A", "An"}:  # not "Foucault, The Order of Things"
                others |= ys
        self.cache[full] = (named, years, others)
        return self.cache[full]

    def in_chapter(self, author, chapter):
        """Does this chapter's own works-cited list include the author?"""
        _, full, surname, given = author
        text = self.chapters.get(chapter)
        if not text:
            return False
        firsts = "|".join(re.escape(g.split()[0]) for g in given)
        return bool(re.search(rf"(?<![-–’'\w]){surname},\s+(?:{firsts})\b", text))

    def ambiguous(self, author):
        _, full, surname, given = author
        key = "ambiguous " + full
        if key not in self.cache:
            firsts = {g.split()[0] for g in given}
            # A different first name counts once it recurs ("Jonathan Gray" in
            # Data Feminism); a one-off is more likely a title ("Beyond Foucault").
            counts = {}
            for n in re.findall(rf"\b([A-Z][a-z]+)\s+(?:[A-Z]\.\s+)?{surname}\b", self.text):
                counts[n] = counts.get(n, 0) + 1
            names = {n for n, c in counts.items() if c >= 2}
            # "Brooke Foucault Welles" doesn't make Michel Foucault ambiguous.
            inside = {n for n in names for a in CORE_AUTHORS for g in a[3] if g.endswith(f"{n} {surname}")}
            others = names - firsts - NON_NAMES - inside
            self.cache[key] = bool(others or self.check(author)[2])
        return self.cache[key]


# Lowercase roles that introduce someone other than a scholar by surname alone.
ROLE_WORDS = {
    "instructor", "teacher", "director", "manager", "supervisor", "officer", "attorney",
    "judge", "senator", "representative", "detective", "sergeant", "captain", "coach",
    "principal", "nurse", "caseworker", "worker", "mayor", "governor", "commissioner",
}

# Co-authors whose surnames, cited alongside, confirm which author is meant.
COAUTHORS = {
    "Sarah J. Jackson": ["Bailey", "Welles"],
    "Moya Bailey": ["Jackson", "Welles"],
    "Brooke Foucault Welles": ["Jackson", "Bailey"],
    "Kishonna L. Gray": ["Sarkeesian"],
    "Elizabeth Losh": ["Wernimont"],
    "Jacqueline Wernimont": ["Losh"],
    "Rebecca Walton": ["Moore", "Jones"],
    "Kristen Moore": ["Walton", "Jones"],
    "Natasha Jones": ["Walton", "Moore"],
    "Catherine D'Ignazio": ["Klein"],
    "Lauren F. Klein": ["D[’']Ignazio", "Gold"],
    "Matthew K. Gold": ["Klein"],
    "Thomas S. Mullaney": ["Peters", "Hicks", "Philip"],
    "Benjamin Peters": ["Mullaney", "Hicks", "Philip"],
    "Mar Hicks": ["Mullaney", "Peters", "Philip"],
    "Kavita Philip": ["Mullaney", "Peters", "Hicks"],
}

# How far a full-name mention carries a later bare surname on a PDF book.
PAGE_WINDOW = 40


def find_mentions(text, author, last_named, attest, scope):
    """Yield (start, end) spans of genuine mentions of `author` in `text`.

    A mention counts when the surname is preceded by one of the author's given
    names; or it stands alone and the most recent full-name use of that surname
    was this author (so "Jonathan Gray" doesn't count as Kishonna Gray) — and,
    if the book names anyone else with that surname, that use was in the same
    chapter or within PAGE_WINDOW pages; or it's an author–date citation like
    "(Noble 2018)" and the book cites this author, and no one else with that
    surname in that year.

    `scope` is (chapter id, page); `last_named` maps surname -> (who, scope).
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
            if not match and tokens[-1][0] == given[0][0] and coauthor_nearby(full, text, m):
                match = tokens[-1]  # "D’Ignazio and Laura Klein"
            if match:
                last_named[key] = (full, scope)
                yield m.start(2) - len(match) - 1, m.end(2)
            else:
                last_named[key] = (joined, scope)
            continue
        before = text[:m.start(2)].split()
        if before and before[-1] in ROLE_WORDS:
            continue  # "the instructor Ahmed": someone known by role and surname
        cite = YEAR_CITE.match(text, m.end(2))
        if ET_AL.match(text, m.end(2)) and book_id not in MULTI_AUTHOR_BOOKS and not cite:
            continue  # "Ahmed et al." is rarely the single author named earlier
        if cite:
            named, years, others = attest.check(author)
            year = re.search(r"(?:19|20)\d\d", cite.group(0))
            year = year.group(0) if year else None
            if named and (not others or (year in years and year not in others)):
                last_named[key] = (full, scope)
                yield m.start(2), m.end(2)
                continue
            if year in others and year not in years and not coauthor_nearby(full, text, m):
                continue  # a dated citation to someone else with this surname
        who, where = last_named.get(key, (None, None))
        if who == full and (not attest.ambiguous(author) or nearby(where, scope)
                            or attest.in_chapter(author, scope[0])):
            yield m.start(2), m.end(2)
        elif coauthor_nearby(full, text, m):
            # "Jackson, Bailey, and Foucault Welles"; "Gray and Sarkeesian"
            last_named[key] = (full, scope)
            yield m.start(2), m.end(2)


def coauthor_nearby(full, text, m):
    names = COAUTHORS.get(full)
    window = text[max(0, m.start(2) - 50):m.end(2) + 50]
    return bool(names) and bool(re.search(r"\b(?:" + "|".join(names) + r")\b", window))


def nearby(earlier, now):
    chapter, page = earlier
    if chapter is not None and chapter == now[0]:
        return True
    return page is not None and now[1] is not None and 0 <= now[1] - page <= PAGE_WINDOW


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


def chapter_of_page(book):
    """PDF page -> the chapter it falls in, from the PDF's bookmarks.

    Chapters are the top two bookmark levels, minus "Part I"-style dividers and
    bookmarks that are only identifiers (McKinney's "9781478009337-ix").
    """
    marks = sorted((e["section"], e["title"]) for e in book.get("toc", [])
                   if e.get("level", 0) <= 1 and e.get("section")
                   and not re.match(r"(?i)part\b", e["title"])
                   and re.search(r"[A-Za-z]{3}", e["title"]))
    out, current, i = {}, None, 0
    for p in book["pages"]:
        while i < len(marks) and marks[i][0] <= p["locator"]:
            current = chapter_label(marks[i][1])
            i += 1
        out[p["locator"]] = current
    return out


def print_label(page):
    """The print edition's page(s) a PDF page covers: "p. 47" / "pp. 47–48"."""
    first, last = (page or {}).get("print_pages") or (None, None)
    if not first:
        return None
    return f"p. {first}" if first == last else f"pp. {first}–{last}"


def build_source(meta):
    book_id = meta["id"]
    cfg = OVERRIDES.get(book_id, {})
    book = json.loads((BOOKS_DIR / f"{book_id}.json").read_text())
    pages = {p["locator"]: p for p in book["pages"]}
    chapter = chapter_of_page(book)
    chapter_text = {}
    for p in book["pages"]:
        if chapter[p["locator"]]:
            chapter_text[chapter[p["locator"]]] = chapter_text.get(chapter[p["locator"]], "") + "\n" + p["text"]
    targets = book_targets(book_id, " ".join(meta.get("author") or []))
    attest = Attestation("\n".join(p["text"] for p in book["pages"]), chapter_text)
    surnames = re.compile(r"\b(?:" + "|".join(a[2] for a in targets) + r")\b")

    # Merge consecutive pieces of the same kind into runs, marking page starts.
    runs = []
    for kind, loc, text in regions(book, cfg):
        piece = f"{MARK}L{loc}{MARK}\n" + text  # own line, so line-start patterns still match
        if runs and runs[-1][0] == kind:
            runs[-1][2].append(piece)
        else:
            runs.append([kind, loc, [piece]])

    # Only the main text: notes, acknowledgments and the rest are left out.
    units = [(loc, split_sentences(flatten("\n".join(pieces))))
             for kind, loc, pieces in runs if kind == "body"]

    mentions, last_named, seen = [], {}, set()
    for run_loc, sents in units:
        for i, (s, page) in enumerate(sents):
            page = page or run_loc
            if not surnames.search(s) or is_bib_entry(s) or ACK_H.match(chapter.get(page) or ""):
                continue
            for author in targets:
                hits = list(find_mentions(s, author, last_named, attest, (chapter.get(page), page)))
                if not hits or (author[1], s) in seen:
                    continue
                seen.add((author[1], s))
                mentions.append({
                    "bookId": author[0],
                    "author": author[1],
                    "section": chapter.get(page),
                    "page": print_label(pages.get(page)) or f"PDF page {page}",
                    "locator": page,
                    "before": sents[i - 1][0] if i > 0 else "",
                    "sentence": s,
                    "after": sents[i + 1][0] if i + 1 < len(sents) else "",
                    "highlights": [s[a:b] for a, b in hits],
                })
    return {"title": meta["title"], "authors": meta.get("author") or [], "mentions": mentions}


def main():
    index = json.loads((DATA_DIR / "index.json").read_text())
    # Oldest first, so the list reads as the conversation unfolding
    books = sorted(index["books"], key=lambda b: (b.get("original_year") or b.get("year") or 9999,
                                                  b["title"].lstrip("#").lower()))
    out = {"sources": {}}
    for meta in books:
        src = build_source(meta)
        # When the work first came out, which orders the timeline
        src["year"] = meta.get("original_year") or meta.get("year")
        out["sources"][meta["id"]] = src
        print(f"{src['year']} {meta['id']}: {len(src['mentions'])} mentions")
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
