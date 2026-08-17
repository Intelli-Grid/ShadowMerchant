"""
ShadowMerchant — Clean Audit Checklist Duplicate Lines
"""

import re
from pathlib import Path

def clean_checklist():
    path = Path(__file__).parent / "SKU_AUDIT_CHECKLIST.md"
    content = path.read_text(encoding="utf-8")

    # Remove orphaned duplicate un-checked blocks
    cleaned = re.sub(
        r"(-\s*\*\*Tracked Snapshots:\*\*\s*1\s*\|\s*\*\*Seller:\*\*\s*Unspecified\n-\s*\*\*Verification Checks:\*\*\n(?:\s*-\s*\[ \][^\n]+\n){5})",
        "",
        content
    )

    path.write_text(cleaned.strip() + "\n", encoding="utf-8")
    print("Cleaned duplicate un-checked blocks from SKU_AUDIT_CHECKLIST.md.")

if __name__ == "__main__":
    clean_checklist()
