#!/usr/bin/env python3
"""
talking.py — builds the "Talking to Each Other" cross-reference data.

For each source book listed in SOURCES, finds every place another author on
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

# Source books to scan. `notes` are the locators holding endnotes; `skip` are
# front matter, figure credits and indexes that aren't prose.
SOURCES = {
    "dignazio-data-feminism-strong-ideas": {
        "notes": [18, 19],
        "skip": [1, 2, 3, 17, 20, 21],
    },
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

def flatten(text):
    """Collapse line-broken prose into one string, dropping bare note markers."""
    text = re.sub(r"\n\d{1,3}\n", "\n", text)       # superscript note refs
    text = re.sub(r"\s*\n\s*", " ", text)
    text = re.sub(r"\s+([,.;:?!’”)])", r"\1", text)  # space left before punctuation
    return re.sub(r"\s{2,}", " ", text).strip()


ABBREVIATIONS = {
    "e.g", "i.e", "al", "Dr", "Mr", "Mrs", "Ms", "St", "ed", "eds", "vol", "Vol",
    "no", "No", "pp", "p", "cf", "vs", "Jr", "Sr", "etc", "Inc", "Co", "trans",
    "U.S", "Ph.D", "Mt", "Fig", "fig", "ch", "Prof", "rev",
}

SENT_END = re.compile(r"[.!?][’”\"')\]]*\s+(?=[“‘\"'(\[]?[A-Z0-9])")


def split_sentences(text):
    sentences, start = [], 0
    for m in SENT_END.finditer(text):
        before = text[start:m.start() + 1]
        word = re.search(r"(\S+)\.$", before.rstrip("’”\"')]"))
        if word:
            w = word.group(1).lstrip("(“‘\"'")
            # Initials ("Lauren F. Klein") and known abbreviations don't end sentences.
            if re.fullmatch(r"[A-Z]", w) or w in ABBREVIATIONS or re.fullmatch(r"(?:[A-Z]\.)+[A-Z]", w):
                continue
        sentences.append(text[start:m.end()].strip())
        start = m.end()
    tail = text[start:].strip()
    if tail:
        sentences.append(tail)
    return sentences


def split_notes(pages):
    """Split endnote pages into (chapter, number, text) records."""
    raw = "\n".join(re.sub(r"^Notes\n(Notes\n)?", "", p["text"]) for p in pages)
    parts = re.split(r"\n(\d{1,3})\n\.\s*", "\n" + raw)
    notes, chapter = [], None
    lead = parts[0].strip().splitlines()
    if lead:
        chapter = chapter_label(lead[-1])
    for i in range(1, len(parts), 2):
        num, body = int(parts[i]), parts[i + 1]
        lines = body.rstrip().split("\n")
        next_num = int(parts[i + 2]) if i + 2 < len(parts) else None
        # A chapter heading sits on the line just before the next chapter's note 1.
        next_chapter = None
        if next_num == 1 and len(lines) > 1:
            next_chapter = lines.pop().strip()
        notes.append({"chapter": chapter, "number": num, "text": flatten("\n".join(lines))})
        if next_chapter:
            chapter = chapter_label(next_chapter)
    return notes


def chapter_label(heading):
    """"2\u2003Collect, Analyze" -> "Chapter 2: Collect, Analyze"."""
    heading = re.sub(r"\s+", " ", heading).strip()
    return re.sub(r"^(\d+) ", r"Chapter \1: ", heading)


def section_title(page):
    return chapter_label(page["text"].split("\n", 1)[0])

# ─── Mention detection ──────────────────────────────────────────────────────

NAME_TOKEN = r"(?:[A-Z][a-zé’'-]+|[A-Z]\.)"


def find_mentions(text, author, last_named):
    """Yield (start, end) spans of genuine mentions of `author` in `text`.

    A mention counts when the surname is preceded by one of the author's given
    names, or stands alone and the most recent full-name use of that surname in
    the book was this author (so "Jonathan Gray" doesn't count as Kishonna Gray,
    and a later bare "Gray" is attributed to whoever was last named in full).
    """
    book_id, full, surname, given = author
    pat = re.compile(rf"((?:{NAME_TOKEN}\s+){{0,3}})\b({surname})(?![-–\w])(?!\s+(?:[A-Z]\.|[A-Z][a-z]+\s+[A-Z]|[A-Z][a-z]+\b(?![,.;:’'])))")
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
        elif last_named.get(key) == full:
            yield m.start(2), m.end(2)


NON_NAMES = {
    "As", "See", "Writes", "In", "For", "And", "But", "The", "This", "That", "Like",
    "When", "While", "Though", "Although", "Here", "Also", "Both", "Scholars",
    "Sociologist", "Historian", "Professor", "Philosopher", "Theorist", "Ed", "Ed.",
    "Eds.", "Cf.", "With", "By", "On", "To", "Following", "According", "If", "So",
    "Yet", "Then", "Thus", "Indeed", "Because", "Since", "Rather", "Or", "Of",
}


def build_source(book_id, cfg):
    book = json.loads((BOOKS_DIR / f"{book_id}.json").read_text())
    self_authors = {a[1] for a in CORE_AUTHORS if a[0] == book_id}
    targets = [a for a in CORE_AUTHORS if a[0] != book_id and a[1] not in self_authors]

    units = []  # (location dict, sentences)
    for p in book["pages"]:
        loc = p["locator"]
        if loc in cfg["skip"] or loc in cfg["notes"]:
            continue
        units.append(({"in_notes": False, "section": section_title(p), "locator": loc},
                      split_sentences(flatten(p["text"]))))
    for n in split_notes([p for p in book["pages"] if p["locator"] in cfg["notes"]]):
        units.append(({"in_notes": True, "section": n["chapter"], "note": n["number"],
                       "locator": cfg["notes"][0]},
                      split_sentences(n["text"])))

    mentions = []
    last_named = {}
    for loc, sents in units:
        for i, s in enumerate(sents):
            for author in targets:
                hits = list(find_mentions(s, author, last_named))
                if not hits:
                    continue
                mentions.append({
                    "bookId": author[0],
                    "author": author[1],
                    **loc,
                    "before": sents[i - 1] if i > 0 else "",
                    "sentence": s,
                    "after": sents[i + 1] if i + 1 < len(sents) else "",
                    "highlights": [s[a:b] for a, b in hits],
                })
    return {"title": book["title"], "authors": book["author"], "mentions": mentions}


def main():
    out = {"sources": {bid: build_source(bid, cfg) for bid, cfg in SOURCES.items()}}
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    for bid, src in out["sources"].items():
        print(f"{bid}: {len(src['mentions'])} mentions")


if __name__ == "__main__":
    main()
