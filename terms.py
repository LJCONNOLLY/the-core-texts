#!/usr/bin/env python3
"""
terms.py — builds "How the term evolved in these readings".

For each glossary term, counts how often every book on the core list uses it
(with its plural and related forms) in the main text, and shortlists the
sentences where the book comes closest to defining it. A reader (Claude, or
you) then picks one passage per book and writes a plain definition, the
book's stance toward the term and what the book changes; those judgments are
cached in data/ai-cache/terms/<term>.json and merged in by `build`.

    python3 terms.py candidates gender classification   # shortlists to judge
    python3 terms.py build gender classification        # data/terms/*.json
    python3 terms.py build                              # every glossary term
    python3 terms.py judge gender --model <model-id>    # judge pending via the API

`judge` needs ANTHROPIC_API_KEY. It sends each pending shortlist, with the
definitions already written for earlier books on the timeline, and saves the
answer to the cache, so nothing already judged is sent again.

Every quote is checked against the book's text before it is saved: a judged
passage that no longer appears word for word on its page is dropped and
reported, never shown.

Output:
  data/terms/index.json      term -> uses per book (for the picker)
  data/terms/<term>.json     the timeline for one term
"""

import hashlib
import json
import re
import sys
from pathlib import Path

import talking

ROOT_DIR = Path(__file__).parent
DATA_DIR = ROOT_DIR / "data"
BOOKS_DIR = DATA_DIR / "books"
OUT_DIR = DATA_DIR / "terms"
CACHE_DIR = DATA_DIR / "ai-cache" / "terms"
PENDING_DIR = CACHE_DIR / "pending"

GLOSSARY = json.loads((ROOT_DIR / "glossary.json").read_text())["terms"]

# Each term with its plural and related forms, as one case-insensitive
# pattern. Checked by hand: "trans" must not catch "trans." (translated by)
# or words like "transform"; "race" must not catch "trace".
TERM_FORMS = {
    "text": r"texts?|textual(?:ity|ly)?",
    "technology": r"technolog(?:y|ies|ical|ically)",
    "discourse": r"discourses?|discursive(?:ly)?",
    "remediation": r"remediat(?:ion|ions|e|es|ed|ing)",
    "misogynoir": r"misogynoir",
    "design-justice": r"design justice",
    "coding-literacy": r"cod(?:ing|e) literac(?:y|ies)",
    "episteme": r"epistemes?",
    "cultural-analytics": r"cultural analytics",
    "procedural-rhetoric": r"procedural rhetorics?",
    "surveillance": r"surveillance|surveil(?:s|led|ling)?",
    "classification": r"classif(?:y|ies|ied|ying|ication|ications|icatory|ier|iers)",
    "categorization": r"categor(?:y|ies|ize|izes|ized|izing|ization|izations|ise|ised|isation)",
    "infrastructure": r"infrastructur(?:e|es|al)",
    "gender": r"gender(?:s|ed|ing)?",
    "race": r"races?|racial(?:ly|ized|ised|ization|isation|izing)?",
    "identity": r"identit(?:y|ies)",
    "biopolitics": r"biopolitic(?:s|al)|biopower",
    "datafication": r"datafi(?:cation|ed|es|y|ying)",
    "algorithms": r"algorithm(?:s|ic|ically)?|algorithmics",
    "visibility": r"(?:in|hyper)?visib(?:ility|ilities|le|ly)",
    "embodiment": r"(?:dis)?embod(?:iment|iments|ied|y|ies|ying)",
    "intersectionality": r"intersectional(?:ity|ly)?",
    "citizenship": r"citizen(?:s|ship)?",
    "borders": r"border(?:s|ed|ing|lands?)?",
    "health": r"health(?: ?care)?",
    "risk": r"risk(?:s|y|ed|ing)?",
    "normativity": r"normativ(?:e|ity)|norms?|normali[sz](?:e|es|ed|ing|ation)|(?:hetero|homo|cis)normativ(?:e|ity)",
    "erasure": r"erasures?|eras(?:e|es|ed|ing)",
    "transparency": r"transparen(?:cy|t|tly)|opa(?:city|que)",
    "accountability": r"accountab(?:ility|le)",
    "rights": r"rights",
    "feminist": r"feminis(?:t|ts|m|ms)",
    "queer": r"queer(?:s|ness|ing|ed)?",
    "trans": r"trans(?!\.)(?![-\w])|transgender|transness",
    "disability": r"disabilit(?:y|ies)|disabled",
    "labor": r"labou?r(?:s|ed|ing|ers?)?",
    "design": r"design(?:s|ed|er|ers|ing)?",
    "visualization": r"visuali[sz](?:ation|ations|e|es|ed|ing)",
    "rhetoric": r"rhetorics?|rhetorical(?:ly)?|rhetors?",
}


def term_re(term_id):
    return re.compile(r"(?<![\w-])(?:" + TERM_FORMS[term_id] + r")(?![\w-])", re.IGNORECASE)


# ─── The main text, as paragraphs ───────────────────────────────────────────

NOTE_REF = re.compile(r"[⁰¹²³⁴⁵⁶⁷⁸⁹]+")
PRINT_TOKEN = re.compile(r"\s*\{\{p\. [^}]+\}\}\s*")
NOTE_LINE = re.compile(r"^\d{1,3}[.\s]")


def clean(text):
    """A block's text as printed: without print-page tokens or note numbers."""
    text = PRINT_TOKEN.sub(" ", text)
    text = NOTE_REF.sub("", text)
    return re.sub(r"\s{2,}", " ", text).strip()


# Where the author's own text begins, and sections written by someone else
START_H = re.compile(r"(?i)^\s*(preface|prologue|introductions?|intro\b|chapter\s+(1|one)\b|part\s+(i|one|1)\b|1\.?\s+[A-Z“\"])")
OTHER_VOICE_H = re.compile(r"(?i)^\s*(series\s+(editor|foreword|introduction)|foreword(?!\s+to\s+the)|publisher[’']?s\s+note|"
                           r"general\s+editor|praise\b|about\s+the\s+author|other\s+books|also\s+by|contributors\b)")
CONTENTS_H = re.compile(r"(?i)^\s*(table\s+of\s+)?contents\b")


def section_heads(book):
    """PDF page -> the section titles that start on it: bookmarks, plus the
    headings the layout pass found, plus the page's first line."""
    heads = {}
    for e in book.get("toc", []):
        if e.get("level", 0) <= 1:
            heads.setdefault(e["section"], []).append(e["title"])
    for p in book["pages"]:
        blocks = p.get("blocks") or []
        heads.setdefault(p["locator"], []).extend(b["x"] for b in blocks if b["t"] in ("h2", "h3"))
        if blocks:
            heads[p["locator"]].append(blocks[0]["x"][:80])
    return heads


def is_contents_page(p):
    lines = [l for l in p["text"].split("\n") if l.strip()]
    if any(CONTENTS_H.match(l) for l in lines[:3]):
        return True
    return bool(lines) and sum(bool(re.search(r"\s(\d{1,3}|[ivxlc]+)\s*$", l)) for l in lines) / len(lines) > 0.3


def own_text_pages(book):
    """Pages from the first preface, prologue, introduction or first chapter
    on, minus forewords, series introductions and the like by other people."""
    heads = section_heads(book)
    pages = {p["locator"]: p for p in book["pages"]}
    start = next((loc for loc in sorted(heads)
                  if loc in pages and not is_contents_page(pages[loc])
                  and any(START_H.match(h) for h in heads[loc])), None)
    out, other = set(), False
    for loc in sorted(pages):
        if start is not None and loc < start:
            continue
        hs = heads.get(loc, [])
        if any(OTHER_VOICE_H.match(h) for h in hs):
            other = True
        elif other and any(START_H.match(h) or re.match(r"\s*\d{1,2}\b|[A-Z]", h) for h in hs[:-1] or []):
            other = False  # the next section heading ends it
        if not other:
            out.add(loc)
    return out


def body_pages(book, book_id):
    """PDF pages that are main text, by talking.py's rules (no front matter,
    notes, bibliography, index or acknowledgments). A page counts when most of
    its text is main text."""
    own = own_text_pages(book)
    share = {}
    for kind, loc, text in talking.regions(book, talking.OVERRIDES.get(book_id, {})):
        body, total = share.get(loc, (0, 0))
        share[loc] = (body + (len(text) if kind == "body" else 0), total + len(text))
    chapter = talking.chapter_of_page(book)
    return {loc for loc, (b, t) in share.items()
            if t and b / t > 0.5 and loc in own and not talking.ACK_H.match(chapter.get(loc) or "")}


def paragraphs(book, book_id):
    """Main-text paragraphs and block quotes: [(kind, [(sentence, locator)])].
    A paragraph that runs onto the next page is joined up, and each sentence
    keeps the page it starts on."""
    body = body_pages(book, book_id)
    paras = []
    for p in book["pages"]:
        if p["locator"] not in body:
            continue
        for i, b in enumerate(p.get("blocks") or []):
            if b["t"] not in ("p", "q"):
                continue
            text = f"{talking.MARK}L{p['locator']}{talking.MARK} " + clean(b["x"])
            # Carried over from the last page: the layout pass says so, or the
            # last paragraph stopped mid-sentence and this one starts lowercase.
            carried = b.get("cont") or (paras and not re.search(r"[.?!:”’\")]\s*$", paras[-1][1])
                                        and re.match(r"[a-z]", b["x"]))
            if i == 0 and carried and paras and paras[-1][0] == b["t"]:
                paras[-1][1] += " " + text
            else:
                paras.append([b["t"], text])
    return [(kind, talking.split_sentences(text)) for kind, text in paras]


def extra_blocks(book, body):
    """Other main-text blocks that count toward uses: headings, centered lines,
    tables and small type that isn't a note."""
    for p in book["pages"]:
        if p["locator"] in body:
            for b in p.get("blocks") or []:
                if b["t"] in ("h2", "h3", "c", "t") or (b["t"] == "s" and not NOTE_LINE.match(b["x"])):
                    yield clean(b["x"])


# ─── Shortlisting ───────────────────────────────────────────────────────────

def definitional(rx):
    t = rx.pattern
    return [
        re.compile(rf"{t}\s*[,”’\"']?\s*(?:is|are|was|were)\s+(?:not\s+)?(?:a|an|the|about|what|how|never|always|both)\b", re.I),
        re.compile(rf"{t}\s*[,”’\"']?\s*(?:refers?|refer)\s+to|{t}\s*[,”’\"']?\s*(?:means?|denotes?|describes?|names?|signals?|captures?)\b", re.I),
        re.compile(rf"\bdefin\w*\s+(?:\w+\s+){{0,3}}[“\"‘']?{t}|{t}[”\"’']?\s*(?:,\s*)?(?:is|are)?\s*defined\b", re.I),
        re.compile(rf"\bby\s+[“\"‘']?{t}[”\"’']?\s*,?\s*(?:I|we)\s+mean|\b(?:I|we)\s+(?:use|understand|define|mean|call|treat)\s+(?:the\s+term\s+)?[“\"‘']?{t}", re.I),
        re.compile(rf"\b(?:concept|notion|idea|term|theory|category|framework|logic|politics|practice)s?\s+of\s+(?:the\s+)?[“\"‘']?{t}", re.I),
        re.compile(rf"\bunderstand\w*\s+(?:\w+\s+){{0,2}}{t}\s+as\b|{t}\s+(?:is|are)\s+(?:best\s+)?understood\s+as\b|{t}\s+as\s+(?:a|an)\b", re.I),
        re.compile(rf"\bwhat\s+(?:I|we)\s+call\b|\bthe\s+term\s+[“\"‘']?{t}", re.I),
    ]


def shortlist(paras, rx, size=8):
    """The sentences most likely to show what the book means by the term."""
    patterns = definitional(rx)
    found, first = [], None
    for pi, (kind, sents) in enumerate(paras):
        in_para = sum(len(rx.findall(s)) for s, _ in sents)
        for si, (s, loc) in enumerate(sents):
            hits = rx.findall(s)
            if not hits:
                continue
            words = len(s.split())
            score = 4 * sum(bool(p.search(s)) for p in patterns)
            score += min(in_para - len(hits), 3)            # a paragraph about the term
            score += 1 if re.search(r"[“\"‘']\s*" + rx.pattern, s, re.I) else 0
            score += 1 if first is None else 0              # the book's first use
            score -= 3 if words < 8 or words > 75 else 0
            score -= 2 if kind == "q" else 0                 # someone else's words
            if re.match(r"[a-z]", s) or not re.search(r"[.?!:”’\")\]]$", s):
                score -= 10                                   # a fragment, not a sentence
            first = first or (pi, si)
            found.append({"score": score, "para": pi, "loc": loc, "kind": kind,
                          "before": sents[si - 1][0] if si else "",
                          "sentence": s,
                          "after": sents[si + 1][0] if si + 1 < len(sents) else ""})
    found.sort(key=lambda c: -c["score"])
    picked, per_para = [], {}
    for c in found:
        if per_para.get(c["para"], 0) < 2:
            picked.append(c)
            per_para[c["para"]] = per_para.get(c["para"], 0) + 1
        if len(picked) == size:
            break
    return sorted(picked, key=lambda c: (c["para"], c["loc"]))


# ─── Verification ───────────────────────────────────────────────────────────

def squash(text):
    return re.sub(r"\s+", " ", text).strip()


def page_text(book, loc):
    """A page's main text as printed, plus the next page's, so a sentence
    that runs over the page break can still be found."""
    out = []
    for p in book["pages"]:
        if loc <= p["locator"] <= loc + 1:
            out.append(" ".join(clean(b["x"]) for b in p.get("blocks") or []))
    return squash(" ".join(out))


def verified(book, loc, quote):
    return squash(quote) in page_text(book, loc)


# ─── Books ──────────────────────────────────────────────────────────────────

def load_books():
    index = json.loads((DATA_DIR / "index.json").read_text())
    books = sorted(index["books"], key=lambda b: (b.get("original_year") or 9999, b["title"].lstrip("#").lower()))
    for meta in books:
        yield meta, json.loads((BOOKS_DIR / f"{meta['id']}.json").read_text())


def page_label(book, loc):
    page = next((p for p in book["pages"] if p["locator"] == loc), None)
    return talking.print_label(page) or f"PDF p. {loc}"


def digest(cands):
    return hashlib.sha1("\n".join(c["sentence"] for c in cands).encode()).hexdigest()[:12]


def scan(term_ids):
    """term -> book -> {uses, candidates}"""
    out = {t: {} for t in term_ids}
    for meta, book in load_books():
        paras = paragraphs(book, meta["id"])
        body = body_pages(book, meta["id"])
        extras = list(extra_blocks(book, body))
        for t in term_ids:
            rx = term_re(t)
            uses = sum(len(rx.findall(s)) for _, sents in paras for s, _ in sents)
            uses += sum(len(rx.findall(x)) for x in extras)
            cands = shortlist(paras, rx) if uses else []
            for c in cands:
                c["page"] = page_label(book, c["loc"])
            out[t][meta["id"]] = {"meta": meta, "book": book, "uses": uses, "candidates": cands}
        print(f"  scanned {meta['id']}", file=sys.stderr)
    return out


def load_cache(term_id):
    path = CACHE_DIR / f"{term_id}.json"
    return json.loads(path.read_text()) if path.exists() else {}


def candidates(term_ids):
    """Write the shortlists still waiting for a judgment to ai-cache/terms/pending/."""
    PENDING_DIR.mkdir(parents=True, exist_ok=True)
    found = scan(term_ids)
    for t in term_ids:
        cache = load_cache(t)
        pending = []
        for book_id, r in found[t].items():
            if not r["uses"] or book_id in cache:
                continue
            m = r["meta"]
            pending.append({
                "bookId": book_id,
                "title": m["title"], "authors": m.get("author") or [], "year": m.get("original_year"),
                "uses": r["uses"],
                "input": digest(r["candidates"]),
                "candidates": [{k: c[k] for k in ("loc", "page", "kind", "before", "sentence", "after")}
                               for c in r["candidates"]],
            })
        (PENDING_DIR / f"{t}.json").write_text(json.dumps(pending, ensure_ascii=False, indent=1))
        print(f"{t}: {len(pending)} books to judge")


def build(term_ids):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    index_path = OUT_DIR / "index.json"
    index = json.loads(index_path.read_text()) if index_path.exists() else {"terms": {}}
    found = scan(term_ids)
    for t in term_ids:
        cache = load_cache(t)
        entries, problems = [], []
        for book_id, r in found[t].items():
            m, book = r["meta"], r["book"]
            e = {"bookId": book_id, "title": m["title"], "authors": m.get("author") or [],
                 "year": m.get("original_year"), "editionYear": m.get("year"), "uses": r["uses"]}
            j = cache.get(book_id)
            if r["uses"] and j:
                if not verified(book, j["locator"], j["quote"]):
                    problems.append(f"{book_id}: quote not found on its page, dropped")
                else:
                    e.update({
                        "quote": j["quote"], "locator": j["locator"], "page": page_label(book, j["locator"]),
                        "definition": j["definition"], "stance": j["stance"], "changed": j.get("changed", ""),
                    })
            elif r["uses"] and not r["candidates"]:
                e["note"] = "Used only in headings, captions or tables, never in a full sentence."
            elif r["uses"]:
                problems.append(f"{book_id}: {r['uses']} uses but no judgment yet")
            entries.append(e)
        term = next(g for g in GLOSSARY if g["id"] == t)
        (OUT_DIR / f"{t}.json").write_text(json.dumps(
            {"id": t, "term": term["term"], "forms": TERM_FORMS[t], "books": entries},
            ensure_ascii=False, indent=1))
        index["terms"][t] = {"term": term["term"], "uses": {e["bookId"]: e["uses"] for e in entries},
                             "judged": sum("quote" in e for e in entries)}
        print(f"{t}: {sum(e['uses'] > 0 for e in entries)} books use it, "
              f"{sum('quote' in e for e in entries)} judged")
        for p in problems:
            print("   ", p)
    index["terms"] = {g["id"]: index["terms"][g["id"]] for g in GLOSSARY if g["id"] in index["terms"]}
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1))


PROMPT = """You are helping a PhD student see how the term "{term}" is used across the books on their exam list.

Book: {title} by {authors} (first published {year}). It uses the term {uses} times in its main text.
Books earlier on the timeline, with how they use it:
{earlier}

Candidate passages from this book, each exactly as printed:
{candidates}

Pick the ONE candidate where the author comes closest to defining "{term}" or shows most clearly what they mean by it.
Answer with JSON only:
{{"pick": <candidate number>,
 "definition": "<one or two plain sentences a high school student could follow: what this book means by the term>",
 "stance": "<defines | in passing | critiques>",
 "changed": "<one sentence: what this book adds or changes compared with the earlier books>"}}
"defines" = the book gives its own account of the term; "in passing" = uses it without explaining it;
"critiques" = it criticizes someone else's use or treatment of it."""


def ask_claude(prompt, model):
    import os
    import urllib.request
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        sys.exit("judge needs ANTHROPIC_API_KEY")
    base = os.environ.get("ANTHROPIC_BASE_URL", "https://api.anthropic.com").rstrip("/")
    req = urllib.request.Request(
        f"{base}/v1/messages", method="POST",
        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        data=json.dumps({"model": model, "max_tokens": 800,
                         "messages": [{"role": "user", "content": prompt}]}).encode())
    with urllib.request.urlopen(req, timeout=120) as res:
        text = json.loads(res.read())["content"][0]["text"]
    return json.loads(text[text.index("{"):text.rindex("}") + 1])


def judge(term_ids, model):
    """Judge the pending shortlists through the API, oldest book first."""
    candidates(term_ids)
    for t in term_ids:
        cache = load_cache(t)
        term = next(g for g in GLOSSARY if g["id"] == t)["term"]
        for p in json.loads((PENDING_DIR / f"{t}.json").read_text()):
            earlier = [f"- {cache[b]['year']}: {cache[b]['definition']}" for b in cache
                       if cache[b].get("year") and cache[b]["year"] <= (p["year"] or 9999)]
            prompt = PROMPT.format(
                term=term, title=p["title"], authors=", ".join(p["authors"]), year=p["year"], uses=p["uses"],
                earlier="\n".join(earlier) or "(none: this is the first book on the timeline)",
                candidates="\n".join(f"[{i}] ({c['page']}) {c['sentence']}" for i, c in enumerate(p["candidates"])))
            j = ask_claude(prompt, model)
            c = p["candidates"][int(j["pick"])]
            cache[p["bookId"]] = {"input": p["input"], "locator": c["loc"], "quote": c["sentence"],
                                  "definition": j["definition"], "stance": j["stance"],
                                  "changed": j["changed"], "judge": "claude", "year": p["year"]}
            (CACHE_DIR / f"{t}.json").write_text(json.dumps(cache, ensure_ascii=False, indent=1))
            print(f"  {t}: judged {p['bookId']}")


def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ("candidates", "build", "judge"):
        sys.exit(__doc__)
    args = sys.argv[2:]
    model = None
    if "--model" in args:
        i = args.index("--model")
        model = args[i + 1]
        args = args[:i] + args[i + 2:]
    if sys.argv[1] == "judge" and not model:
        sys.exit("judge needs --model <model-id>")
    term_ids = args or [g["id"] for g in GLOSSARY]
    unknown = [t for t in term_ids if t not in TERM_FORMS]
    if unknown:
        sys.exit(f"No forms for {unknown}: add them to TERM_FORMS")
    if sys.argv[1] == "judge":
        judge(term_ids, model)
    else:
        (candidates if sys.argv[1] == "candidates" else build)(term_ids)


if __name__ == "__main__":
    main()
