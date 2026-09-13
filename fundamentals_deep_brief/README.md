# Fundamentals Deep-Brief v2

Institutional desk research engine replacing thin metric snapshots with an audited, fail-closed 4–8 page deep brief for US-listed tickers.

Based on **Fundamentals Deep-Brief App — Build Spec v2** (2026-09-13).

---

## Core Principles

1. **Never Invent Financials**: No fabricated backlog, contract values, market shares, or guidance. Every hard number cites a source ID.
2. **Fail-Closed Audit Protocol**: `number_audit.py` validates every numeric token in narrative text against the factual data store. Ungrounded hallucinations (e.g. `$999B`) are automatically stripped.
3. **No Fake DCF**: No fabricated WACC or terminal growth rates presented as objective truth. DCF is only offered as a user-controllable sensitivity model.
4. **Institutional Voice**: Dense, plain English, no hype, no "exciting opportunity" filler.

---

## Document Architecture (Required Chapters)

- **Chapter A · Cover Strip**: Ticker, company name, exchange, timestamps, 25-word one-line thesis stub (`[Desk synthesis]`), and 7-metric stats ribbon.
- **Chapter B · Business Model**: Target customers, revenue contract structure (MSA / project / subscription / take-or-pay), unit of demand, 10-K segment mix %, 10-K geographic mix %, value-chain tier map, and "What They Explicitly Are NOT".
- **Chapter C · Competitive Position**: Scale benchmarking against 3–6 named peers (Revenue, EV, Margins), evidenced Moat Hypotheses (`[Hypothesis]`), 10-K customer concentration disclosures, and substitutes/insourcing risk.
- **Chapter D · Financial Statement Quality & Economics**: 3-5Y revenue CAGR, audited multi-year profitability table, cash flow economics (OCF, CapEx, FCF, FCF conversion), balance sheet solvency & interest coverage, and accruals quality checks (NI vs OCF divergence).
- **Chapter E · Valuation in Context**: Absolute multiples (P/E, EV/Sales, EV/EBITDA, FCF yield), peer relative table & medians, 5-year historical price range, what the market is pricing, and user-editable DCF sandbox.
- **Chapter F · Catalysts, Sourced Risks & Monitoring**: Identifiable event catalysts with timelines, categorized 10-K risk factors (Operational, Financial, Regulatory, Cyclical), and next-quarter desk checklist.
- **Chapter G · Sources Appendix & Audit Trail**: Footnote mapping tracing every numeric cell to a source ID, SEC accession numbers, Yahoo timestamps, and explicit inventory of failed fetches.

---

## CLI Usage

```bash
# Basic run (writes PDF, HTML, and JSON sidecar to ./out/)
python app/cli.py PWR

# With custom peer basket
python app/cli.py PWR --peers EME,MTZ,FLR,DY

# With thematic focus filter
python app/cli.py NVDA --focus ai-infra

# Custom output destination and format
python app/cli.py CPRT --out ./reports/CPRT_brief.pdf --format pdf
```

### Output Files
- **PDF Report (Primary)**: `out/<TICKER>_deep_brief.pdf` (WeasyPrint / print-ready)
- **HTML Document (Fallback & Browser View)**: `out/<TICKER>_deep_brief.html`
- **JSON Sidecar**: `out/<TICKER>_deep_brief.json` with raw `BriefData` for trading desk scanners.

---

## Web UI & API Integration

- **Interactive Desk Tab**: Mounted directly inside `DeepFundamentalsDashboard.jsx` under `📄 Desk Deep-Brief v2`.
- **API Endpoints**:
  - `GET /api/deep_brief?ticker=PWR&peers=EME,MTZ`: returns structured JSON.
  - `GET /api/deep_brief/document?ticker=PWR`: renders the standalone HTML document for immediate printing or PDF saving.

---

## Testing Verification

```bash
# Run unit test asserting ungrounded injected numbers ($999B) are stripped
python -m unittest fundamentals_deep_brief.tests.test_audit_injection
```
