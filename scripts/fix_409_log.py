import os

path = 'scripts/social/telegram_poster.py'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the specific block of text
old_text = '''        if isinstance(context.error, Conflict):
            import asyncio as _asyncio
            logger.warning(
                "Telegram Conflict (409): another bot instance is polling. "
                "Render zero-downtime deploy in progress. Waiting 30s..."
            )
            await _asyncio.sleep(30)'''

new_text = '''        if isinstance(context.error, Conflict):
            logger.warning(
                "Telegram Conflict (409): another bot instance is polling. "
                "Render zero-downtime deploy in progress. Poller will retry in background until old instance dies."
            )'''

# We also want to replace CRLF if necessary
if old_text not in text:
    old_text = old_text.replace('\n', '\r\n')
    new_text = new_text.replace('\n', '\r\n')

text = text.replace(old_text, new_text)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Patch applied")
