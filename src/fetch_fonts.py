#!/usr/bin/env python3
"""Self-host Google Fonts: download latin + latin-ext WOFF2 and emit @font-face CSS."""
import re, urllib.request, os

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"}
FAMS = [
    ("Antonio", "family=Antonio:wght@600;700"),
    ("Inter", "family=Inter:wght@400;500"),
    ("JetBrains Mono", "family=JetBrains+Mono:wght@400;500"),
    ("Instrument Serif", "family=Instrument+Serif:ital,wght@0,400;1,400"),
]
ROOT = os.path.join(os.path.dirname(__file__), "..")
OUT = os.path.join(ROOT, "assets", "fonts")
os.makedirs(OUT, exist_ok=True)
css_out = []
for fam, q in FAMS:
    url = f"https://fonts.googleapis.com/css2?{q}&display=swap"
    css = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30).read().decode()
    # blocks: /* subset */ @font-face { ... }
    for m in re.finditer(r"/\*\s*([a-z-]+)\s*\*/\s*(@font-face\s*\{[^}]+\})", css):
        subset, block = m.group(1), m.group(2)
        if subset not in ("latin", "latin-ext"):
            continue
        u = re.search(r"url\((https://[^)]+\.woff2)\)", block).group(1)
        style = re.search(r"font-style:\s*(\w+)", block).group(1)
        weight = re.search(r"font-weight:\s*(\d+)", block).group(1)
        slug = fam.lower().replace(" ", "-")
        fn = f"{slug}-{weight}{'-italic' if style=='italic' else ''}-{subset}.woff2"
        data = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=30).read()
        open(os.path.join(OUT, fn), "wb").write(data)
        block = re.sub(r"src:\s*url\([^)]+\)\s*format\('woff2'\)", f"src: url('../fonts/{fn}') format('woff2')", block)
        css_out.append(f"/* {fam} {weight} {style} {subset} */\n{block}")
        print(f"{fn}  {len(data)//1024}KB")
open(os.path.join(ROOT, "assets", "css", "fonts.css"), "w").write("\n".join(css_out) + "\n")
print("-> assets/css/fonts.css")
