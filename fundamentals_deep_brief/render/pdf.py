"""
fundamentals_deep_brief/render/pdf.py
Renders the Institutional Deep Brief v2 document into:
1. Primary PDF via WeasyPrint (if available)
2. Standalone, print-ready HTML fallback
"""

import os
import re
from typing import Dict, Any, Optional

try:
    from jinja2 import Environment, FileSystemLoader
    JINJA_AVAILABLE = True
except ImportError:
    JINJA_AVAILABLE = False

try:
    from weasyprint import HTML as WeasyHTML, CSS as WeasyCSS
    WEASYPRINT_AVAILABLE = True
except Exception:
    WEASYPRINT_AVAILABLE = False

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

def format_billions(val, decimals=2, default="---"):
    if val is None:
        return default
    try:
        return f"${float(val) / 1e9:.{decimals}f}B"
    except Exception:
        return default

def format_pct(val, default="---"):
    if val is None:
        return default
    try:
        return f"{float(val):.1f}%"
    except Exception:
        return default

def render_html_document(brief_data: Dict[str, Any]) -> str:
    """Renders the brief data into a standalone HTML document."""
    template_path = os.path.join(CURRENT_DIR, "template_deep.html")
    css_path = os.path.join(CURRENT_DIR, "styles.css")
    
    with open(css_path, "r", encoding="utf-8") as f:
        css_content = f.read()

    if JINJA_AVAILABLE:
        env = Environment(loader=FileSystemLoader(CURRENT_DIR))
        env.filters["billions"] = format_billions
        env.filters["pct"] = format_pct
        template = env.get_template("template_deep.html")
        return template.render(data=brief_data, css_content=css_content)
    else:
        with open(template_path, "r", encoding="utf-8") as f:
            raw_html = f.read()
        return raw_html.replace("{{ css_content }}", css_content)

def generate_deep_brief_pdf(brief_data: Dict[str, Any], output_path: str) -> Dict[str, Any]:
    """
    Generates a 4-8 page PDF deep brief.
    If WeasyPrint is available and functional, writes PDF directly.
    Otherwise, generates an HTML file fallback at output_path.replace('.pdf', '.html').
    """
    html_content = render_html_document(brief_data)
    
    # Check if target is .pdf
    is_pdf_target = output_path.lower().endswith(".pdf")
    html_fallback_path = output_path[:-4] + ".html" if is_pdf_target else output_path

    # Always write the HTML document as reference
    with open(html_fallback_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    if is_pdf_target and WEASYPRINT_AVAILABLE:
        try:
            weasy_doc = WeasyHTML(string=html_content, base_url=CURRENT_DIR)
            weasy_doc.write_pdf(output_path)
            return {
                "format": "pdf",
                "path": output_path,
                "html_path": html_fallback_path,
                "status": "success",
                "engine": "WeasyPrint"
            }
        except Exception as e:
            print(f"[generate_deep_brief_pdf] WeasyPrint rendering failed: {e}. Falling back to HTML.")

    return {
        "format": "html",
        "path": html_fallback_path,
        "status": "success",
        "engine": "HTML_Fallback"
    }
