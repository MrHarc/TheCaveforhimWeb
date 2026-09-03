#!/usr/bin/env bash
# Assemble a clean, publishable dist/ for static hosting (Netlify, Cloudflare Pages…).
#
#   ./src/make-dist.sh                        # canonical = data/business.json site_base
#   SITE_BASE=https://x.netlify.app ./src/make-dist.sh   # showcase build
#
# Only the public site goes in. Sources (src/, data/, copy/, qa/, upscale_batch/,
# README, PRODUCT.md) stay out, as do the retouching originals and the assets the
# refined stylesheet no longer references.
set -euo pipefail
cd "$(dirname "$0")/.."
DIST="dist"

python3 src/build.py

rm -rf "$DIST"
mkdir -p "$DIST"

# routes + root files
cp index.html 404.html robots.txt sitemap.xml favicon.ico "$DIST/"
for r in about careers experience find-us gallery services legal; do
  [ -d "$r" ] && cp -R "$r" "$DIST/"
done
# locale mirrors (src/build.py BUILD_LANGS): each is a full copy of the routes
# above under its own prefix, so glob whatever the build actually produced
# rather than hard-coding the language list in two places.
for d in */; do
  d="${d%/}"
  case "$d" in
    assets|src|qa|copy|data|dist|upscale_batch|about|careers|experience|find-us|gallery|services|legal) continue ;;
  esac
  [ -f "$d/index.html" ] && cp -R "$d" "$DIST/" && echo "  locale mirror: $d/"
done

# assets, minus the things the built site never asks for
mkdir -p "$DIST/assets"
cp -R assets/css assets/js assets/fonts assets/img assets/video "$DIST/assets/"

# retouching originals and upscale sources — never served
rm -f "$DIST"/assets/img/*-src.png "$DIST"/assets/img/*-src.jpg "$DIST"/assets/img/og-source.jpg
# ornament plates dropped in the refinement (frames, button neon)
rm -f "$DIST"/assets/img/frame-copper.webp "$DIST"/assets/img/glow-copper.webp "$DIST"/assets/img/glow-green.webp
# unreferenced stills and the uncompressed ambient master (cave-ambient-web.mp4 is the one used)
rm -f "$DIST"/assets/img/brand-shop.png "$DIST"/assets/video/cave-ambient.mp4

# guard: nothing the pages reference may be missing
missing=0
while IFS= read -r ref; do
  [ -f "$DIST$ref" ] || { echo "MISSING: $ref"; missing=1; }
done < <(grep -rhoE '/assets/[A-Za-z0-9_./-]+\.(css|js|woff2|avif|webp|jpg|png|mp4|ico|svg)' \
           "$DIST"/index.html "$DIST"/*/index.html "$DIST"/legal/*/index.html "$DIST"/404.html \
           "$DIST"/assets/css/*.css 2>/dev/null | sort -u)
[ "$missing" -eq 0 ] || { echo "dist is incomplete — aborting."; exit 1; }

# A prebuilt upload has no repo context, so the header rules travel with the
# files. netlify.toml at the repo root still serves CLI/git builds; this is the
# same policy expressed the way a direct dist deploy can read it.
cat > "$DIST/_headers" <<'HDR'
/*
  X-Robots-Tag: noindex, nofollow
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
/assets/*
  Cache-Control: public, max-age=31536000, immutable
HDR

echo "dist/ ready — $(du -sh "$DIST" | cut -f1), $(find "$DIST" -type f | wc -l | tr -d ' ') files"
echo "canonical origin: $(grep -o 'rel="canonical" href="[^"]*"' "$DIST/index.html" | head -1)"
