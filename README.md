# The Cave — Barbershop, La Cala de Mijas

Static, production-ready marketing site replacing the old Wix site at thecaveforhim.com.
Built August 2026 from the verified research dossier. Every business fact on the site
comes from one file; nothing is invented.

## Run it locally

```bash
cd TheCave_Website
python3 -m http.server 4780
```

Open http://localhost:4780. (The Claude preview config `thecave` in `~/.claude/launch.json` does the same.)

## Rebuild after any change

```bash
python3 src/build.py
```

Pages are generated from templates in `src/build.py` + data + copy. Never edit the
HTML files at the root directly — they are build output.

## Where things live

| What | Where |
|---|---|
| **Every business fact** (name, address, phones, WhatsApp, email, booking URL, hours, services + prices, socials, Google rating) | `data/business.json` — one edit updates UI + JSON-LD everywhere |
| All English copy | `copy/en.json` |
| Spanish strings (live at `/es/`) | `copy/es.json` |
| Design tokens (the only place colours exist) | `assets/css/critical.css` `:root` block |
| Below-the-fold styles | `assets/css/main.css` |
| Behaviour (menu, reveals, accordion, sticky bar, open/closed status, careers form) | `assets/js/main.js` |
| Image derivation (crops, AVIF/WebP/JPEG variants, favicons, video compress) | `src/process-images.sh` |
| Self-hosted fonts | `assets/fonts/` (fetched by `src/fetch_fonts.py`) |
| QA screenshots + rig | `qa/` |

## Changing a price / the hours / the Google rating

Edit `data/business.json`, run `python3 src/build.py`. Done.

- **Google rating**: the `rating` block is the single constants block (UI reads it).
  Confirm the live figure on launch day. AggregateRating is deliberately NOT in the
  JSON-LD until the owner confirms it at launch — add it in `src/build.py` `jsonld()`
  if wanted, reading from the same block.
- **Hours**: the `hours` block. Monday needs owner confirmation (see below).

## Image slots — owner exports

Real photography currently on the site was exported at web resolution from the
official @thecaveforhim Instagram embeds on 2026-08-12. For launch, export the
originals from the camera roll and drop them over the same masters, then re-run
`src/process-images.sh` and `src/build.py`:

| Master file (assets/img/) | Source post | Used for |
|---|---|---|
| `ig_DCPO5U6M1sN.jpg` | instagram.com/thecaveforhim/reel/DCPO5U6M1sN | hero (16:9 + 4:5 crops), the room, about |
| `ig_DXYl5lyDNCD.jpg` | instagram.com/thecaveforhim/p/DXYl5lyDNCD | svc-cut, work-01 |
| `ig_DVbU0tXjA6b.jpg` | instagram.com/thecaveforhim/p/DVbU0tXjA6b | svc-beard, work-02 |
| `ig_DWHkomCDPGq.jpg` | instagram.com/thecaveforhim/p/DWHkomCDPGq | work-03 |
| `ig_DVftsnsjG00.jpg` | instagram.com/thecaveforhim/p/DVftsnsjG00 | work-04 |
| `ig_DXbLr1GjFh6.jpg` | instagram.com/thecaveforhim/p/DXbLr1GjFh6 | svc-detail, work-05 |
| `svc-combo-src.jpg` | owner-supplied, AI resolution-enhanced (2026-08-16) | svc-combo (services page, Cut and Beard) |
| `exp-consult-src.jpg` | owner-supplied (2026-08-18) | experience-consult (IMG-EXP-01, /experience) |

**Still-empty slots** (rendered as designed placeholders until supplied — never stock,
never AI):

- ~~`IMG-EXP-01` — barber and client talking before the cut, 4:5~~ — filled
  2026-08-18 from `exp-consult-src.jpg`. **Confirm before launch**: the supplied
  photograph is an outdoor terrace scene rather than the shop interior the slot
  was briefed for, a shisha pipe is visible in frame, and three people are
  identifiable — the site's rule is verified first-party photography with
  sign-off from anyone recognisable.
- `IMG-WORK-06` — a sixth finished result (kids cut or head shave), 3:4 → `work-06`
- ~~A combo cut+beard photo for the services page (`IMG-SVC-COMBO`)~~ — filled
  2026-08-16 from `svc-combo-src.jpg`. **Confirm with the owner that this is the
  shop's own photograph before launch**: it arrived as an AI resolution-enhanced
  export, and the site's rule is verified first-party photography only.
- Optional portraits of Gabriel and Ygor (only with their sign-off)
- A higher-resolution re-export of the shop video (current source is the 480p Wix
  rendition; `src/process-images.sh` compresses it to <3MB for the desktop-only
  ambient hero)

Wordmark: `assets/img/logo.png` is the 500×247 PNG from the old site. Ask the owner
for an SVG or 2× export when available — drop in place, same filename.

## The photograph frame

Every photograph sits in an engraved Art Deco copper frame, applied as a CSS
9-slice `border-image` (see `.tile, .menu-group__media, …` in `assets/css/main.css`).

| | |
|---|---|
| Shipped asset | `assets/img/frame-copper.webp` — 640×640, 69 KB |
| Master | `assets/img/frame-copper-src.png` — 2048×2048 from WaveSpeed (`google/nano-banana-pro/text-to-image`, 2026-08-16) |
| Slice inset | **144** (of 640) — the corner square the ornament lives inside |
| Width / outset | `--cave-frame-w` / `--cave-frame-out` in `critical.css` |

Why 9-slice: the corner brackets stay pixel-locked at any aspect ratio while only
the plain parallel runs between them stretch. A frame stretched whole would smear
its corners on the 21:9 and 3:2 slots. `border-width` is 0 and the band is pushed
outward with `border-image-outset`, so the frame hangs *outside* the picture — no
layout shift, nothing cropped.

**Replacing the frame** — regenerate square, then verify three things before
shipping it, because 9-slice depends on all of them:

1. the four corners are exact mirrors and the artwork is symmetrical
2. the ornament stays inside its corner square (measure how far it reaches along
   each edge; the slice inset must be larger)
3. the straight runs between corners are perfectly uniform — any motif there
   smears when stretched

Knock the black ground out to alpha with a soft knee (`alpha = (luminance-34)/26`,
clamped) so the frame's own dark mat stays opaque while the ground goes fully
transparent; the halo comes from `--cave-frame-bloom` in CSS, not from the render.

## Button glow

The neon on the booking and WhatsApp buttons is a generated plate, not a
box-shadow: soft light rendered by Nano Banana Pro and 9-sliced the same way as
the photograph frame.

| | |
|---|---|
| Assets | `assets/img/glow-copper.webp` (BOOK, slice **51**), `glow-green.webp` (WhatsApp, slice **43**) — 256x256, ~40 KB each |
| Masters | `glow-copper-src.png`, `glow-green-src.png` — 2048x2048 from WaveSpeed (`google/nano-banana-pro/text-to-image`, 2026-08-18) |
| Band width | `--btn-glow-w` in `critical.css` |

The plate is hung entirely outside the button with `border-image-outset`, so it
adds no layout. Two wiring details worth knowing before editing:

- `border-image` **replaces** border painting, so `.btn--primary`'s crisp edge is
  an `outline` with a negative offset rather than a border.
- `.btn--primary` has `overflow: hidden` for its shine sweep, so its plate sits on
  the element itself (an element's own border-image is not clipped by its own
  overflow). The WhatsApp buttons do not clip, so their plate lives on `::before`,
  which lets its opacity keep breathing.

Regenerating: keep the interior pure black, the falloff finishing before the
canvas edge, and the straight runs identical along their length — the slice
inset must be at least the distance from the canvas edge to the black interior.
Knock out with `alpha = luminance` and un-premultiplied colour, so the falloff
becomes an alpha falloff.

## Spanish (/es)

The architecture is bilingual-ready; English ships first per the current decision.
To go live in Spanish:

1. Complete the missing keys in `copy/es.json` (English falls back automatically —
   whatever you don't translate stays English). The strings already present are the
   brief's §9 Spanish, verbatim. Brand name is never translated.
2. Have the owner (or a native speaker) read it.
3. In `src/build.py` set `BUILD_LANGS = ["en", "es"]`.
4. `python3 src/build.py` — /es/ mirrors, reciprocal hreflang and the sitemap
   regenerate automatically.

## Owner confirmations before launch (carried from the brief)

1. **Monday hours** — old Spanish site said closed, booking system says 10:00–18:30
   (currently shown), shopfront sign says Tue–Fri. Fix in `data/business.json`.
   The HTML carries a source comment at every hours block.
2. **WhatsApp number** — links use the business mobile +34 603 555 121
   (`CONFIRM WHATSAPP NUMBER BEFORE LAUNCH` comments sit next to every use).
3. Facebook still lists the old street address — owner should update Facebook.
4. Tattoo: excluded sitewide (nothing supports it beyond the old footer).
5. Gabriel + Ygor named with title "Barber" only — confirm they're happy, supply
   portraits if wanted.
6. Google rating on launch day → `data/business.json`.
7. 12–18 high-res exports per the slot table above.

## Deviations from the brief (documented, deliberate)

- **Home Experience section** uses the real room photo (IMG-EXP-02) as its bleed
  image instead of the not-yet-supplied consultation shot (IMG-EXP-01); the
  placeholder for EXP-01 lives on /experience. Real verified photography was
  preferred over a placeholder in the highest-traffic slot.
- **No cookie banner**: the site sets no cookies and loads no third-party scripts,
  so there is nothing to consent to. /legal/cookies explains this. If analytics is
  ever added, add a real consent banner first (reject as easy as accept).
- **Careers form** composes an email in the visitor's own mail app (no backend
  exists; a form that silently posts nowhere would be dishonest). Visible email
  fallback + noscript fallback included.
- **AVIF/WebP/JPEG** all generated; sources are 720px-wide Instagram exports, so
  srcsets top out at the real source width (hero is a documented 2× lanczos upscale).
  Re-run `src/process-images.sh` after dropping in high-res originals to regenerate
  everything at full quality (add larger widths to the `plan` dict).

## QA rig

`qa/shoot.mjs` (deno + puppeteer-core against system Chrome) captures every page
full-page plus each home section at 1440×900 and mobile at 390×844:

```bash
cd qa && deno run -A --node-modules-dir=auto shoot.mjs
```

### Phone/desktop regression rig (node + Playwright)

Added for the iPhone Safari adaptation. Needs a directory with `node_modules`
containing `playwright` (+ browsers), `pixelmatch`, `pngjs` — pass it via
`QA_RIG`; the site must be serving on `localhost:4780`.

```bash
QA_RIG=~/qa-rig node qa/desktop-baseline.mjs qa/desktop-baseline   # locked-desktop captures (10 routes × 5 sizes, deterministic)
QA_RIG=~/qa-rig node qa/desktop-diff.mjs qa/desktop-baseline <dir> # pixel compare — desktop must stay at zero
QA_RIG=~/qa-rig node qa/scrub-check.mjs                            # desktop scroll-film acts/CTA/seek assertions
QA_RIG=~/qa-rig node qa/phone-audit.mjs --engine=webkit            # full iPhone matrix: overflow, targets, menu, bar, forms, media
QA_RIG=~/qa-rig node qa/phone-extended.mjs                         # reduced-motion, no-JS, 200% text, keyboard, throttled LCP/CLS
QA_RIG=~/qa-rig node qa/phone-shots.mjs                            # phone screenshot set for eyeballing
```

Append `?noanim=1` to any URL to disable entrance animations (used for screenshots).

Verified in this build: every internal link resolves (328 refs, 0 missing); no
console errors; hero CTA visible without scrolling at 375×667; no horizontal
scroll at 320px; keyboard reaches BOOK NOW at tab 3 with a skip link first; the
mobile menu traps focus, closes on Escape and restores focus; open/closed status
computes in Europe/Madrid time; sticky bar hides on scroll-down, returns on
scroll-up; prices match the booking system exactly.


## Scroll-scrub hero (desktop)

The desktop hero is a scroll-driven ink-sketch film (aerial -> storefront -> signage,
made from the shop's own photography). Scrolling drives `video.currentTime` — no
autoplay, no scroll-hijack; the visitor's scroll is the timeline.

- Film: `assets/video/cave-scroll.mp4` (14s, 1280x720, dense keyframes for seeking, ~4MB,
  fetched as a blob after `load` so it never competes with first paint).
- Poster: `assets/img/scrub-poster.{webp,jpg}` — painted as the >=1024px hero image, so the
  film fades in over its own first frame.
- Gates: >=1024px, fine pointer, no `prefers-reduced-motion`, no Save-Data. Everything else
  (mobile, tablet, no-JS) keeps the photographic hero and never downloads the film.
- Text beats: act 1 = H1 + lead + meta, act 2 = "Sharp is a standard, not a favour.",
  act 3 = "Cut with intention." (both from the approved §9 copy pool). The BOOK +
  WhatsApp CTAs stay on screen through all three acts.
- Runway: `data-scrub-runway` on the hero section (vh beyond the first screen; 200 = about
  two flicks of the wheel to ride the whole film). Lower it to make the ride faster.
- To replace the film: overwrite `assets/video/cave-scroll.mp4` (re-encode with
  `-g 12 -sc_threshold 0` so seeking stays smooth) and regenerate the poster from its
  first frame.

### Portrait cut (phones)

Portrait iPhones ride the same 15s timeline in a 9:16 recomposition,
`assets/video/cave-scroll-mobile.mp4` (720x1280, ~6.1MB, closed-GOP `-g 8` seek
encode without B-frames). The frame-aware phone scheduler runs on top: one
in-flight seek, 24fps target quantization, cached geometry, coalesced viewport
updates and offscreen suspension. Gates: <=899px + portrait + coarse pointer +
no reduced-motion + no Save-Data + not 2g/3g. Landscape phones, tablets and
no-JS keep the photographic hero and download nothing.
`data-scrub-runway-mobile` (360vh) sets the touch runway; act text and actions
share the live `100dvh` stage so Safari's collapsing browser chrome cannot make
them overlap. Verify with `qa/scrub-mobile-check.mjs` after replacing either film.

Re-encode a replacement phone cut to keep seeking cheap and the wait short:

```bash
ffmpeg -i master.mp4 -c:v libx264 -profile:v high -pix_fmt yuv420p \
  -crf 27 -g 8 -keyint_min 8 -sc_threshold 0 -bf 0 -refs 2 \
  -movflags +faststart -an assets/video/cave-scroll-mobile.mp4
```

Then bump the `?v=` key on `data-scrub-src-mobile` in `src/build.py` so iPhones
cannot serve a stale film from cache, and rebuild.

### Phone load gate (why the veil exists)

Scrubbing is random access, so a half-buffered film is a stall waiting to
happen: a seek into bytes that have not arrived restarts the decoder and
strands a frame. The phone therefore **downloads the whole film behind the
intro veil** (`fetch` + streamed byte progress -> Blob), exactly as desktop
does, and only then hands it over. Sequence, all of it under the veil:

1. boot script (in `src/build.py`) adds `html.hero-loading` and arms the budget
2. `main.js` fetches the film, emitting `cave:hero-progress` (bytes/total) —
   the veil renders it as a determinate copper bar
3. `loadeddata` -> `engageScrub()`: the sticky stage and 360vh runway appear
   while the page is still covered, so the taller layout is never seen arriving
4. first frame painted -> `cave:hero-ready` -> the veil composes the hero copy
   and lifts

**Budget: 6000ms**, set in the boot script in `src/build.py` (search
`cave:hero-fallback`). On expiry it aborts the download, dispatches
`cave:hero-fallback` and releases the veil to the photographic hero — no film,
no runway, nothing swapped in late. A film that lands after the budget is
discarded rather than jolted in underneath the visitor. Raising the budget
raises the worst-case wait a visitor can be held at the veil; it should only
move together with the film's size.

Readiness is deliberately **not** the poster image decoding. The poster is
preloaded in `<head>` and lands in tens of milliseconds, so releasing on it
put visitors on a hero whose film had barely started — the stutter this gate
exists to remove.


> Logo: assets/img/logo.svg is an interim vector derived from the Wix PNG via Adobe's vectorizer (transparent, stripe preserved). If the owner supplies original vector artwork, replace this file.
