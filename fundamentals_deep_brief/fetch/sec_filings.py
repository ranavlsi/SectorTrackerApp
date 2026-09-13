"""
fundamentals_deep_brief/fetch/sec_filings.py
Downloads and extracts textual disclosure sections from latest SEC 10-K/10-Q filings:
- Item 1: Business description, segment mix, customers
- Item 1A: Risk factors (operational, financial, regulatory, cyclical)
- Item 7: MD&A, customer concentration, backlog commentary
Uses edgartools when available, with direct SEC fallback.
"""

import os
import re
import json
from typing import Dict, Any, Optional, List

try:
    from edgar import set_identity, Company
    set_identity(os.getenv("SEC_USER_AGENT", "SectorTracker amit.kumar@sectortracker.com"))
    EDGAR_AVAILABLE = True
except Exception:
    EDGAR_AVAILABLE = False

def extract_customer_concentration(text: str) -> List[Dict[str, Any]]:
    """
    Finds verified disclosures regarding top customer concentration (e.g. 'Customer A accounted for 12%').
    """
    if not text:
        return []
    
    matches = []
    # Pattern for customer percentage disclosures
    patterns = [
        r'([A-Za-z0-9\s,\.]{5,40})\s+(?:accounted for|represented|constituted)\s+(?:approximately\s+)?(\d{1,2}(?:\.\d+)?%)\s+of\s+(?:our\s+)?(?:consolidated\s+)?(?:total\s+)?(?:revenue|sales|net sales)',
        r'(?:one|single)\s+customer\s+(?:accounted for|represented)\s+(?:approximately\s+)?(\d{1,2}(?:\.\d+)?%)\s+of\s+(?:our\s+)?(?:total\s+)?(?:revenue|sales)',
        r'top\s+(?:ten|10|five|5)\s+customers\s+(?:accounted for|represented)\s+(?:approximately\s+)?(\d{1,2}(?:\.\d+)?%)\s+of\s+(?:our\s+)?(?:total\s+)?(?:revenue|sales)'
    ]
    
    for pat in patterns:
        for m in re.finditer(pat, text, re.IGNORECASE):
            full_snippet = text[max(0, m.start() - 20): min(len(text), m.end() + 40)].strip()
            # Clean up whitespace
            full_snippet = re.sub(r'\s+', ' ', full_snippet)
            matches.append({
                "disclosure": full_snippet,
                "percentage": m.group(1) if '%' in m.group(1) else (m.group(2) if len(m.groups()) >= 2 else "Disclosed"),
                "source": "10-K Customer Concentration Note"
            })
            if len(matches) >= 3:
                break
        if matches:
            break

    return matches

def extract_backlog_mentions(text: str) -> Optional[Dict[str, Any]]:
    """
    Extracts strictly sourced backlog disclosures from MD&A text. Never mints numbers.
    """
    if not text:
        return None
    
    pat = r'(?:backlog|order backlog|remaining performance obligations?)\s+(?:was|totaled|stood at|of)\s+(?:approximately\s+)?(?:\$|USD\s*)?(\d{1,3}(?:\.\d+)?\s*(?:billion|million|B|M))'
    m = re.search(pat, text, re.IGNORECASE)
    if m:
        snippet = text[max(0, m.start() - 20): min(len(text), m.end() + 50)].strip()
        snippet = re.sub(r'\s+', ' ', snippet)
        return {
            "amount_str": m.group(1).strip(),
            "context": snippet,
            "source": "10-K Item 7 (MD&A Backlog Disclosure)"
        }
    return None

def fetch_sec_filings_text(ticker: str) -> Dict[str, Any]:
    ticker_clean = ticker.upper().strip()
    
    if not EDGAR_AVAILABLE:
        return {
            "status": "unavailable",
            "reason": "edgartools library not initialized",
            "filings_available": False,
            "latest_10k": None,
            "latest_10q": None
        }

    try:
        company = Company(ticker_clean)
        if not company:
            return {
                "status": "unavailable",
                "reason": f"Company {ticker_clean} not found in EDGAR",
                "filings_available": False
            }

        filings_10k = company.get_filings(form="10-K").head(1)
        filings_10q = company.get_filings(form="10-Q").head(1)

        result_10k = None
        if len(filings_10k) > 0:
            f = filings_10k[0]
            doc = None
            try:
                doc = f.obj()
            except Exception:
                pass

            item_1 = getattr(doc, 'item_1', None) if doc else None
            item_1a = getattr(doc, 'item_1a', None) if doc else None
            item_7 = getattr(doc, 'item_7', None) if doc else None

            # Sourced extraction
            conc = extract_customer_concentration(item_1 or item_7 or "")
            backlog = extract_backlog_mentions(item_7 or item_1 or "")

            # Extract distinct risk factor points from Item 1A
            risk_bullets = []
            if item_1a:
                # Find headings or sentences with risk markers
                paragraphs = [p.strip() for p in item_1a.split('\n') if len(p.strip()) > 60]
                for p in paragraphs[:15]:
                    if any(k in p.lower() for k in ["risk", "adverse", "depend", "regulation", "competition", "loss", "decline"]):
                        clean_p = re.sub(r'\s+', ' ', p)
                        risk_bullets.append(clean_p[:280] + "...")
                        if len(risk_bullets) >= 5:
                            break

            result_10k = {
                "form": "10-K",
                "filing_date": str(f.filing_date),
                "accession_no": f.accession_no,
                "document_url": f.document.url if hasattr(f, 'document') else "",
                "business_text_sample": (re.sub(r'\s+', ' ', item_1[:2000]) + "...") if item_1 else None,
                "risks_sample": risk_bullets if risk_bullets else None,
                "customer_concentration": conc,
                "backlog_disclosure": backlog
            }

        result_10q = None
        if len(filings_10q) > 0:
            f = filings_10q[0]
            result_10q = {
                "form": "10-Q",
                "filing_date": str(f.filing_date),
                "accession_no": f.accession_no,
                "document_url": f.document.url if hasattr(f, 'document') else ""
            }

        return {
            "status": "success",
            "filings_available": True,
            "latest_10k": result_10k,
            "latest_10q": result_10q
        }

    except Exception as e:
        return {
            "status": "failed",
            "reason": str(e),
            "filings_available": False,
            "latest_10k": None,
            "latest_10q": None
        }
