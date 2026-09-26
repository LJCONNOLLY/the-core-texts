# Rebuilding the site's data

Everything the site shows comes from JSON files in `data/`, written by the
scripts below. Run them from the repository root, in this order. Each one
only reads what the scripts before it wrote.

```sh
pip install -r requirements.txt

python3 extract.py     # pdfs/*.pdf -> data/books/, data/index.json, data/search/  (~6 min)
python3 talking.py     # data/books -> data/talking.json                            (~1 min)
python3 terms.py build # data/books + judgments -> data/terms/                      (~1 min)
```

## Publication order

Timelines use `original_year` from `pdfs/manifest.json`: the year the work
first came out, not the year of the edition in `pdfs/`. Books where the two
differ: Foucault (1966), Ong (1982), Rose (2001), Latour (2005), Nakamura
(2008), Chun (2016), Risam (2018), Losh & Wernimont (2019).

## How the term evolved (`terms.py`)

1. **Counting and shortlisting** (no AI): for each glossary term, the script
   counts every form of the word (`TERM_FORMS` in `terms.py`) in each book's
   main text, leaving out front matter, forewords by other people,
   acknowledgments, notes, bibliographies and indexes. It then shortlists
   up to 8 sentences per book that look most like a definition.

   ```sh
   python3 terms.py candidates gender classification
   ```

   Shortlists still waiting for a judgment go to
   `data/ai-cache/terms/pending/<term>.json`.

2. **Judging** (Claude): for each book, one passage is picked and a plain
   definition, a stance (`defines`, `in passing` or `critiques`) and a
   "what changed" line are written. These are saved in
   `data/ai-cache/terms/<term>.json`, keyed by book. Anything already there
   is never judged again, so reruns only judge new books or new terms.

   Judging can be done in a Claude Code session, or through the API:

   ```sh
   ANTHROPIC_API_KEY=... python3 terms.py judge gender --model <model-id>
   ```

3. **Building**: `python3 terms.py build` merges the judgments into
   `data/terms/<term>.json` and `data/terms/index.json`. Every quote is
   checked against the book's text. A quote that no longer appears word for
   word on its page (because the extraction changed) is dropped and
   reported, never shown. Re-judge that book, or fix the quote in the cache.

To redo a judgment, delete that book's entry from
`data/ai-cache/terms/<term>.json` and run steps 1–3 again.
