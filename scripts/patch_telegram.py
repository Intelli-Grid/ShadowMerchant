"""Patch broadcast_smart flash label + fix double CRLF + realign scheduler UTC times."""

MOON = chr(0x1F319)   # lrm
GLOBE = chr(0x1F310)  # globe

# Fix 1: telegram_poster.py
poster_path = r"e:\Awesome Projects\ShadowMerchant\scripts\social\telegram_poster.py"

with open(poster_path, "r", encoding="utf-8") as f:
    content = f.read()

# Fix double \r\r\n -> \r\n (artifact from previous patch)
content = content.replace("\r\r\n", "\r\n")

# Fix hardcoded late-night label using string marker search
marker = "More Late Night Deals"
idx = content.find(marker)
if idx != -1:
    line_start = content.rfind('\n', 0, idx) + 1
    line_end = content.find('\n', idx)
    new_line = ('            label = config.get("label", "More Deals")\n'
                f'            await _send_message(bot, f"*{{label}}*\\n\\n"'
                f' + "\\n\\n".join([format_deal_compact(d) for d in deals[1:]])'
                f' + f"\\n\\n{GLOBE} [Browse All]({{APP_URL}}/deals/feed)")')
    content = content[:line_start] + new_line + content[line_end:]
    print("Flash label fixed")
else:
    print("Flash label marker not found - may already be fixed")

with open(poster_path, "w", encoding="utf-8") as f:
    f.write(content)
print("telegram_poster.py saved")

# Fix 2: scheduler.py — realign UTC times
scheduler_path = r"e:\Awesome Projects\ShadowMerchant\scripts\scheduler.py"

with open(scheduler_path, "r", encoding="utf-8") as f:
    sched = f.read()

# Normalize to LF for matching
sched_lf = sched.replace('\r\n', '\n')

OLD_TIMES_LF = (
    '    schedule.every().day.at("02:00").do(trigger_broadcast)\n'
    '    schedule.every().day.at("03:30").do(trigger_broadcast)\n'
    '    schedule.every().day.at("07:30").do(trigger_broadcast)\n'
    '    schedule.every().day.at("10:30").do(trigger_broadcast)\n'
    '    schedule.every().day.at("13:30").do(trigger_broadcast)\n'
    '    schedule.every().day.at("15:00").do(trigger_broadcast)\n'
    '    schedule.every().day.at("16:30").do(trigger_broadcast)'
)

NEW_TIMES_LF = (
    '    # 7 daily broadcasts mapped to IST post-type windows:\n'
    '    #   UTC 01:30 -> IST 07:00  Morning Brief\n'
    '    #   UTC 04:30 -> IST 10:00  Mid-Morning Flash\n'
    '    #   UTC 06:30 -> IST 12:00  Category Spotlight (lunch)\n'
    '    #   UTC 09:30 -> IST 15:00  Platform Spotlight (afternoon)\n'
    '    #   UTC 12:30 -> IST 18:00  Prime Time Flash\n'
    '    #   UTC 14:30 -> IST 20:00  Evening Category Spotlight\n'
    '    #   UTC 16:30 -> IST 22:00  Late Night Picks\n'
    '    schedule.every().day.at("01:30").do(trigger_broadcast)\n'
    '    schedule.every().day.at("04:30").do(trigger_broadcast)\n'
    '    schedule.every().day.at("06:30").do(trigger_broadcast)\n'
    '    schedule.every().day.at("09:30").do(trigger_broadcast)\n'
    '    schedule.every().day.at("12:30").do(trigger_broadcast)\n'
    '    schedule.every().day.at("14:30").do(trigger_broadcast)\n'
    '    schedule.every().day.at("16:30").do(trigger_broadcast)'
)

if OLD_TIMES_LF in sched_lf:
    sched_lf = sched_lf.replace(OLD_TIMES_LF, NEW_TIMES_LF)
    with open(scheduler_path, "w", encoding="utf-8") as f:
        f.write(sched_lf)
    print("Scheduler UTC times realigned successfully")
else:
    print("Could not match scheduler times block")
    idx = sched_lf.find('schedule.every().day.at("02:00")')
    print(f"Found '02:00' at index: {idx}")
    if idx >= 0:
        print(repr(sched_lf[idx:idx+300]))
