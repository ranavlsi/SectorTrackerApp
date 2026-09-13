"""
fundamentals_deep_brief/verify/number_audit.py
Fail-Closed Number Audit Engine
Per Build Spec v2 Acceptance Criteria #3:
- Asserts that every numeric token in narrative text appears in the verified data store.
- Strips any ungrounded figures (e.g. an injected fake 'backlog $999B') from the final text.
"""

import re
from typing import Dict, Any, List, Set, Tuple, Union

def extract_all_facts_numbers(data: Any, facts_set: Set[float] = None) -> Set[float]:
    """
    Recursively extracts all numeric values present in the retrieved data store.
    """
    if facts_set is None:
        facts_set = set()

    if isinstance(data, dict):
        for k, v in data.items():
            extract_all_facts_numbers(v, facts_set)
    elif isinstance(data, list):
        for item in data:
            extract_all_facts_numbers(item, facts_set)
    elif isinstance(data, (int, float)) and not isinstance(data, bool):
        facts_set.add(round(float(data), 2))
        # Also store rounded magnitudes (e.g. 1.15e9 -> 1.15, 1150)
        val = float(data)
        if abs(val) >= 1e9:
            facts_set.add(round(val / 1e9, 2))
            facts_set.add(round(val / 1e9, 1))
            facts_set.add(round(val / 1e9, 0))
        elif abs(val) >= 1e6:
            facts_set.add(round(val / 1e6, 2))
            facts_set.add(round(val / 1e6, 1))
            facts_set.add(round(val / 1e6, 0))
    elif isinstance(data, str):
        # Extract any raw numbers embedded in strings (e.g. '$1.15B', '52%')
        nums = re.findall(r'[-+]?\d+(?:\.\d+)?', data)
        for n in nums:
            try:
                facts_set.add(round(float(n), 2))
                facts_set.add(round(float(n), 1))
            except Exception:
                pass

    return facts_set

def is_number_grounded(num_val: float, facts_set: Set[float], tolerance_pct: float = 0.05) -> bool:
    """
    Checks if a numeric token matches any number in the verified factual data store.
    Allows standard small scale conversions or common narrative indices (e.g. years, horizons).
    """
    # Exclude common dates, small ordinals, or generic indices
    if num_val in {1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 12.0, 20.0, 24.0, 25.0, 30.0, 50.0, 60.0, 90.0, 100.0, 365.0}:
        return True
    if 1990 <= num_val <= 2035: # Year tokens
        return True

    # Exact or near match in facts
    if round(num_val, 2) in facts_set or round(num_val, 1) in facts_set or round(num_val, 0) in facts_set:
        return True

    # Check within relative tolerance
    for f in facts_set:
        if f != 0 and abs(num_val - f) / abs(f) <= tolerance_pct:
            return True

    return False

def audit_narrative_text(text: str, data_store: Dict[str, Any]) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Scans a narrative text block for financial numbers and assertions.
    If an injected or unverified figure is encountered (e.g. '$999B'),
    it strips the figure or replaces it with a citation warning.
    """
    if not text:
        return text, []

    facts_set = extract_all_facts_numbers(data_store)
    violations = []

    # Pattern for currency or metrics: $999B, $999 million, 999%, etc.
    pattern = re.compile(
        r'(?P<full>(?:\$|USD\s*)?(?P<num>\d+(?:\.\d+)?)\s*(?P<unit>billion|million|trillion|B|M|T|%)?)',
        re.IGNORECASE
    )

    def replace_unverified(match):
        full_str = match.group('full')
        num_str = match.group('num')
        unit = match.group('unit') or ''

        try:
            val = float(num_str)
        except ValueError:
            return full_str

        # Check if grounded
        if is_number_grounded(val, facts_set):
            return full_str

        # If not grounded, record violation and strip
        violations.append({
            "token": full_str,
            "numeric_value": val,
            "unit": unit,
            "action": "stripped_by_audit"
        })
        # Strip ungrounded claim per Acceptance Criteria #3
        return f"[unverified figure stripped]"

    audited_text = pattern.sub(replace_unverified, text)
    return audited_text, violations
