"""
Fix two syntax issues in telegram_poster.py:

1. Line 651: `if len(deals) > 1:` has an empty body since the label line
   was inserted at top level instead of inside the if block.
   Fix: indent label + send_message lines under the if.

2. Line 355: `\\.` invalid escape in f-string (Markdown numbered list).
   Fix: use `\\.` with proper raw string or double backslash.
"""

poster_path = r"e:\Awesome Projects\ShadowMerchant\scripts\social\telegram_poster.py"

with open(poster_path, "r", encoding="utf-8") as f:
    content = f.read()

# ── Fix 1: Restore indentation inside `if len(deals) > 1:` block ────────
OLD_IF_BLOCK = (
    "            if len(deals) > 1:\n"
    "\n"
    "            label = config.get(\"label\", \"More Deals\")\n"
    "            await _send_message(bot, f\"*{label}*\\n\\n\""
    " + \"\\n\\n\".join([format_deal_compact(d) for d in deals[1:]])"
    " + f\"\\n\\n\U0001f310 [Browse All]({APP_URL}/deals/feed)\")"
)

NEW_IF_BLOCK = (
    "            if len(deals) > 1:\n"
    "                label = config.get(\"label\", \"More Deals\")\n"
    "                await _send_message(bot, f\"*{label}*\\n\\n\""
    " + \"\\n\\n\".join([format_deal_compact(d) for d in deals[1:]])"
    " + f\"\\n\\n\U0001f310 [Browse All]({APP_URL}/deals/feed)\")"
)

if OLD_IF_BLOCK in content:
    content = content.replace(OLD_IF_BLOCK, NEW_IF_BLOCK)
    print("Fix 1 applied: if block indentation restored")
else:
    # Try matching with \r\n
    OLD_IF_CRLF = OLD_IF_BLOCK.replace("\n", "\r\n")
    NEW_IF_CRLF = NEW_IF_BLOCK.replace("\n", "\r\n")
    if OLD_IF_CRLF in content:
        content = content.replace(OLD_IF_CRLF, NEW_IF_CRLF)
        print("Fix 1 applied (CRLF): if block indentation restored")
    else:
        # Find by line number context and fix directly
        lines = content.replace("\r\n", "\n").split("\n")
        for i, line in enumerate(lines):
            if "if len(deals) > 1:" in line:
                # Check if next non-empty line is NOT indented more
                j = i + 1
                while j < len(lines) and lines[j].strip() == "":
                    j += 1
                if j < len(lines) and lines[j].startswith("            label"):
                    lines[j] = lines[j].replace("            label", "                label")
                    if j + 1 < len(lines) and "await _send_message" in lines[j + 1]:
                        lines[j + 1] = lines[j + 1].replace("            await", "                await")
                    print(f"Fix 1 applied (line-by-line): fixed at line {i+1}")
                    break
        content = "\r\n".join(lines)

# ── Fix 2: Fix invalid `\.` escape in f-string (line 355) ───────────────
# The `\.` in Telegram Markdown is correct for MarkdownV2 but causes
# SyntaxWarning in Python 3.12+ because it's inside an f-string.
# Solution: use raw f-string or double the backslash.
OLD_LINES_FMT = r"    lines = [f\"{i}\. [{d.get('title', '')"
NEW_LINES_FMT = r"    lines = [f\"{i}\\. [{d.get('title', '')"

if OLD_LINES_FMT in content:
    content = content.replace(OLD_LINES_FMT, NEW_LINES_FMT)
    print("Fix 2 applied: \\. escape fixed")
else:
    # Find and fix using a simpler marker
    marker = r"{i}\. ["
    if marker in content:
        content = content.replace(marker, r"{i}\\. [")
        print("Fix 2 applied (marker): \\. escape fixed")
    else:
        print("Fix 2: marker not found - may already be correct")

with open(poster_path, "w", encoding="utf-8") as f:
    f.write(content)

print("\nDone. Verifying syntax...")

import ast, py_compile
try:
    py_compile.compile(poster_path, doraise=True)
    print("Syntax OK - no errors")
except py_compile.PyCompileError as e:
    print(f"SYNTAX ERROR REMAINING: {e}")
