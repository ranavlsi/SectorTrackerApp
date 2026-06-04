import json
from edgar import set_identity, Company
import re

# Set identity as required by SEC EDGAR rules
set_identity("SectorTracker amit.kumar@sectortracker.com")

def get_recent_filings(ticker):
    """
    Fetches the 3 most recent 10-K and 10-Q filings for a ticker.
    Returns metadata and extracts a brief summary of Risk Factors if it's a 10-K.
    """
    try:
        company = Company(ticker)
        if not company:
            return {"error": "Company not found in EDGAR"}
            
        # Get the 5 most recent 10-K or 10-Q filings
        filings = company.get_filings(form=["10-K", "10-Q"]).head(5)
        if len(filings) == 0:
            return {"error": "No recent 10-K or 10-Q filings found."}
            
        results = []
        for filing in filings:
            item = {
                "form": filing.form,
                "date": str(filing.filing_date),
                "accession_no": filing.accession_no,
                "document_url": filing.document.url if hasattr(filing, 'document') else "",
                "summary": ""
            }
            
            # For 10-K, try to extract a snippet of Item 1A (Risk Factors) or Item 7 (MD&A)
            try:
                # `edgartools` `filing.obj()` parses the filing into sections
                doc = filing.obj()
                if filing.form == "10-K" and doc:
                    if hasattr(doc, 'item_1a'):
                        risk_text = doc.item_1a
                        if risk_text:
                            # Clean up and truncate
                            clean_text = re.sub(r'\s+', ' ', risk_text)[:800]
                            item["summary"] = clean_text + "..."
                    elif hasattr(doc, 'item_7'):
                        mda = doc.item_7
                        if mda:
                            clean_text = re.sub(r'\s+', ' ', mda)[:800]
                            item["summary"] = clean_text + "..."
            except Exception as e:
                # If parsing fails, just skip the summary
                pass
                
            results.append(item)
            
        return {
            "ticker": ticker,
            "filings": results
        }
        
    except Exception as e:
        print(f"Error in sec_filings_api for {ticker}: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    import sys
    ticker = sys.argv[1] if len(sys.argv) > 1 else "AAPL"
    print(json.dumps(get_recent_filings(ticker), indent=2))
