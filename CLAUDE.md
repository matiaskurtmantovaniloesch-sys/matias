# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static single-page application (HTML + CSS + vanilla JS, no build step, no backend) for a Brazilian wine retailer. Users import product catalogs from Excel, build per-client quotes with a checklist, and export a PDF report. All data is persisted in `localStorage` — there is no server or database.

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. You can also just open `index.html` directly in the browser — the app is fully static.

No build, no tests, no linter configured. Third-party libs load from CDN at runtime:
- `xlsx` (SheetJS) — Excel parsing/generation
- `jspdf` + `jspdf-autotable` — PDF generation

## Architecture

Three files, one global `state` object, one storage key.

### `app.js` — all logic
Organized in labeled sections (search for `// =======`):
- **IMPORTAR EXCEL**: `importarLinhas()` does fuzzy header matching via regex (`/nome|produto|descri|item|vinho/i`, `/qtd|quant|estoque/i`, `/pre[cç]o|valor|unit/i`) — falls back to positional columns. Existing products (matched by case-insensitive name) are updated, not duplicated.
- **TABELA PRODUTOS**: inline-editable rows; every `change` event writes through to `state.produtos` and calls `saveState()` (persists to `localStorage` under key `adega.produtos.v1`).
- **MODAL**: single modal reused for create/edit, distinguished by `state.editId`.
- **PRECIFICAÇÃO**: `state.selecionados` (id → bool) and `state.qtdVenda` (id → number) are intentionally kept separate from the product list so the catalog remains canonical and selections are ephemeral. Re-renders on every checkbox/quantity change.
- **FINANCEIRO**: `calcularSubtotal()` and `calcularDesconto()` are the single source of truth — both the live UI (`atualizarFinanceiro`) and the PDF/preview re-compute from them. Installments use the standard Price formula (`j*(1+j)^n / ((1+j)^n - 1)`), with `j === 0` as a special case.
- **PDF**: `btn-gerar-pdf` handler rebuilds totals independently (do not trust cached DOM values) and renders via `jspdf-autotable`.

### `state` shape
```
produtos:        [{ id, nome, quantidade, preco }]   // persisted
selecionados:    { [id]: boolean }                    // ephemeral
qtdVenda:        { [id]: number }                     // ephemeral
descontoTipo:    'percent' | 'real'
pagamento:       'vista' | 'parcelado'
cliente:         { nome, data }                       // ISO date
```
Only `produtos` is persisted. Selections/quote data reset on reload — this is intentional (catalog vs. one-off quote).

### Number/currency handling
`parseNumber()` accepts BR-formatted strings (`"R$ 1.234,56"`) and returns a float. Use it on every input read — users paste values from Excel and paperwork in mixed formats. `formatBRL()` is the inverse for display.

### Tabs
Plain `data-tab` attribute + `.active` class toggling. `renderPrecif()` and `renderReport()` are called lazily when their tab is activated, so they always reflect the current state.

## Conventions

- Portuguese (pt-BR) for all user-facing strings, variable names, and comments. Keep it that way.
- No framework, no bundler — if you add a dependency, add a `<script>` tag in `index.html` with a pinned CDN URL.
- `escapeHTML()` must be used for any product name injected via `innerHTML` — product names come from user-uploaded Excel files.
- When changing the `state` shape, bump `STORAGE_KEY` (currently `adega.produtos.v1`) so stale data in users' browsers does not break the app.

## Deployment

Branch `claude/wine-pricing-excel-import-7iRJm` is the working branch. The site is a static bundle — any static host (GitHub Pages, Netlify, Vercel) serves it without configuration.
