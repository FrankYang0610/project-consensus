## Teacher Searching

### Endpoints
- `GET /api/teachers/search-splink/?q=TEXT&page=X&page_size=Y`
  - Approximate matching powered by Splink (DuckDB)
  - Returns: paginated `{ count, next, previous, results }` where `results` are teacher objects sorted by best match first
- `GET /api/teachers/?q=TEXT&page=X&page_size=Y`
  - Basic paginated search (fallback and non-search listing)

Frontend note: `fetchTeachers({ q })` calls the paginated Splink endpoint first. If that fails, it falls back to the basic paginated endpoint.

### Matching rules (simple summary)
- Name normalization
  - Lowercase; remove punctuation and brackets; collapse spaces
  - Drop common titles: `prof`, `professor`, `dr`, `mr`, `mrs`, `ms`, `miss`, `assoc`, `associate`, `asst`, `assistant`, `ir`, `capt`
- Derived name variants (compare multiple views of the name)
  - `name_norm`: normalized name without titles/punctuation
  - `name_rev`: reverse the two-token name (e.g., "nori tev" ↔ "tev nori")
  - `name_sorted`: tokens sorted alphabetically (helps multi-token reorder like "yang ping tat" ↔ "yang tat ping")
- Light blocking (to speed up and reduce noise)
  - First character of `name_norm` must match
  - Last token initial (`last_initial`) must match
  - First character of `department` and normalized `tags` string can also match to admit additional candidates
- Similarity comparisons (Splink)
  - Jaro–Winkler on: `name` (raw), `name_norm`, `name_rev`
  - Exact match on: `name_sorted`
  - Department: exact match + Jaro–Winkler fuzzy match
  - Tags: Jaro–Winkler fuzzy match on a normalized `tags_str` (tags joined and normalized)
  - Final results are ordered by match probability (descending)

### Fallback behavior
- If Splink or its dependencies fail:
  - `name`: Token-AND filter on the normalized query against `name` (all tokens must appear)
  - `department`: `department__icontains` on the original query (loose match)
  - `tags`: `tags__icontains` on any token and on the whole original query
  - Final filter combines with OR: `(name_tokens_and) OR (department_contains) OR (tags_contains)`
- If the frontend Splink call fails: it falls back to the basic paginated endpoint.

### Examples
All example names below are fictitious.
- Order swap and titles
  - Query: "Arel Dovik" or "Prof. Dovik Arel" → Matches the same teacher: Arel Dovik
  - Query: "Assoc Prof. Nori Tev" or "Tev Nori" → Matches the same teacher
- Multi-token reorder
  - Query: "Tavi Nera Sol" or "Tavi Sol Nera" → Matches the same teacher
- Title tokens are ignored
  - Query: "IR Capt Dorim" → Matches teacher "Dorim"
- Punctuation/spacing do not matter
  - Query: "Kara-June Eloran" or "kara june eloran" → Matches the same teacher

### Notes / limitations
- `name_sorted` is an exact-token comparison; it helps when the same tokens appear in a different order.
- If query and record differ in token set (e.g., missing/extra middle token), matching relies on fuzzy similarity (Jaro–Winkler) rather than token-sorted equality.
- No transliteration is applied; matching quality depends on how names are stored (e.g., diacritics stay as-is).

