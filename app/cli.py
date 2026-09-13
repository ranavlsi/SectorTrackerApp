"""
app/cli.py
Top-level entry point per Fundamentals Deep-Brief App Build Spec v2.
Invokes fundamentals_deep_brief.cli
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fundamentals_deep_brief.cli import main

if __name__ == "__main__":
    sys.exit(main())
