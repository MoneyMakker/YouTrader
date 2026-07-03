# YouTrader RAG Knowledge Sources

This folder is the source area for YouTrader's Supabase pgvector knowledge base.

Place verified `.md`, `.txt`, or `.pdf` files under `knowledge/sources/`. The importer supports vendor folders for:

- `topstep`
- `apex`
- `take-profit-trader`
- `lucid`
- `cme`
- `economic-calendar-faq`
- `risk-management-guide`
- `journaling-guide`

Do not commit private, paid, or copyrighted vendor documents unless you have the right to store them in this repository. Prefer short internal Markdown summaries that cite the official source URL and update date.

Run ingestion from a secure local/server environment only:

```bash
SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
OPENAI_API_KEY=... \
npm run rag:import -- --dir=knowledge/sources
```

PDF import requires Poppler:

```bash
brew install poppler
```

