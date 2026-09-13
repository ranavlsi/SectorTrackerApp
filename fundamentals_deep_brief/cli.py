"""
fundamentals_deep_brief/cli.py
Command-line interface for Fundamentals Deep-Brief v2:
Usage:
    deep-brief TICKER [--peers A,B,C] [--out path] [--format pdf|html|json] [--focus ai-infra|consumer|semi|...]
"""

import sys
import os
import argparse
import json

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fundamentals_deep_brief.pipeline import generate_deep_brief_data
from fundamentals_deep_brief.render.pdf import generate_deep_brief_pdf

def main():
    parser = argparse.ArgumentParser(
        prog="deep-brief",
        description="Institutional Desk Research Deep Brief v2.0 Generator (Fail-Closed, 4-8 Page PDF/HTML)"
    )
    parser.add_argument("ticker", help="US-listed stock ticker symbol (e.g. PWR, CPRT, NVDA, AAPL)")
    parser.add_argument("--peers", help="Comma-separated peer symbols (e.g. --peers EME,MTZ,FLR)", default=None)
    parser.add_argument("--focus", help="Sector or thematic focus filter (e.g. ai-infra, consumer, semi)", default=None)
    parser.add_argument("--out", help="Output path for report (e.g. ./PWR_deep_brief.pdf)", default=None)
    parser.add_argument("--format", choices=["pdf", "html", "json", "all"], default="all", help="Output delivery format")

    args = parser.parse_args()
    ticker = args.ticker.upper().strip()
    user_peers = [p.strip().upper() for p in args.peers.split(",")] if args.peers else None

    print(f"\n=======================================================")
    print(f"  FUNDAMENTALS DEEP-BRIEF V2 · INSTITUTIONAL DESK")
    print(f"  Target: {ticker} | Theme: {args.focus or 'General'}")
    print(f"=======================================================")

    print(f"[*] Running multi-layer retrieval (Market, Statements, SEC Filings, Peers)...")
    brief_data = generate_deep_brief_data(
        ticker=ticker,
        user_peers=user_peers,
        focus_theme=args.focus
    )

    cover = brief_data.get("cover", {})
    thesis = cover.get("thesis_stub", "")
    print(f"[+] Cover Assembled: {cover.get('company_name')} (${cover.get('price'):.2f})")
    print(f"    Thesis: {thesis}")

    # Output directory handling
    out_dir = os.path.join(os.getcwd(), "out")
    os.makedirs(out_dir, exist_ok=True)

    default_base = os.path.join(out_dir, f"{ticker}_deep_brief")
    if args.out:
        if args.out.endswith((".pdf", ".html", ".json")):
            default_base = os.path.splitext(args.out)[0]
        else:
            default_base = args.out

    results = {}

    # JSON sidecar (out/TICKER_deep.json per spec)
    if args.format in ["json", "all"]:
        json_path = f"{default_base}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(brief_data, f, indent=2)
        results["json"] = json_path
        print(f"[+] Wrote raw BriefData JSON sidecar: {json_path}")

    # PDF / HTML rendering
    if args.format in ["pdf", "html", "all"]:
        pdf_target = f"{default_base}.pdf"
        render_res = generate_deep_brief_pdf(brief_data, pdf_target)
        results["render"] = render_res
        print(f"[+] Rendered Document ({render_res.get('engine')}): {render_res.get('path')}")
        if render_res.get("html_path") and render_res.get("format") == "pdf":
            print(f"    HTML fallback archive: {render_res.get('html_path')}")

    print(f"\n[OK] Deep-brief generation completed for {ticker}.\n")
    return 0

if __name__ == "__main__":
    sys.exit(main())
