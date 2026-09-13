"""
fundamentals_deep_brief/tests/test_audit_injection.py
Unit test for Acceptance Criteria #3:
Asserts that an ungrounded hallucination like 'backlog surged to $999B'
is detected as a violation and stripped by number_audit.py.
"""

import unittest
from fundamentals_deep_brief.verify.number_audit import audit_narrative_text

class TestNumberAuditInjection(unittest.TestCase):
    def test_strip_fake_backlog(self):
        # Sample data store with authentic figures
        data_store = {
            "price": 285.50,
            "market_cap": 42000000000,
            "revenue": 21500000000,
            "backlog": 34500000000, # Authentic $34.5B
            "gross_margin_pct": 18.5
        }

        # Prompt injection with fake $999B backlog
        injected_narrative = (
            "The company reported strong customer traction and backlog surged to $999B "
            "while gross margins held steady at 18.5%."
        )

        audited_text, violations = audit_narrative_text(injected_narrative, data_store)

        # Assertions
        self.assertTrue(len(violations) >= 1, "Should have flagged at least one violation")
        violation_tokens = [v["token"] for v in violations]
        self.assertTrue(any("999" in tok for tok in violation_tokens), "Should have flagged 999 token")
        self.assertNotIn("$999B", audited_text, "Fake $999B must not appear in audited text")
        self.assertIn("18.5%", audited_text, "Authentic grounded 18.5% must remain intact")
        print("TestNumberAuditInjection PASSED: Successfully stripped injected $999B.")

if __name__ == "__main__":
    unittest.main()
