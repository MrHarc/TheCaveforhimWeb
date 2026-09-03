#!/usr/bin/env python3
"""
THE CAVE — static site builder.

Reads:  data/business.json  (every business fact — the single source of truth)
        data/images.json    (responsive image manifest from src/process-images.sh)
        copy/en.json        (all copy; copy/es.json overlays when 'es' is enabled)
Writes: index.html, <page>/index.html, es/* mirrors (when enabled),
        404.html, robots.txt, sitemap.xml

Usage:  python3 src/build.py
"""
import html
import json
import os

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))

# Locales built. English is the root ("" prefix); every other entry mirrors the
# whole route tree under its own dir_prefix. hreflang, the sitemap, the language
# switch in the header and the /es/ mirrors all derive from this list, so adding
# a third locale means adding copy/<code>.json and one entry here.
# Spanish copy is complete; have the owner read copy/es.json before launch.
BUILD_LANGS = ["en", "es"]

BIZ = json.load(open(os.path.join(ROOT, "data", "business.json")))
IMGS = json.load(open(os.path.join(ROOT, "data", "images.json")))
# Showcase/staging deploys override the canonical origin so a preview build does
# not claim the production domain in canonical, og:url, hreflang or the sitemap.
BASE = os.environ.get("SITE_BASE", BIZ["site_base"]).rstrip("/")

DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]



def asset_v():
    import hashlib
    h = hashlib.sha1()
    for p in ("assets/css/main.css", "assets/js/main.js"):
        h.update(open(os.path.join(ROOT, p), "rb").read())
    return h.hexdigest()[:8]

ASSET_V = None

def esc(s):
    return html.escape(str(s), quote=True)


def deep_merge(base, over):
    out = dict(base)
    for k, v in over.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def load_copy(lang):
    en = json.load(open(os.path.join(ROOT, "copy", "en.json")))
    if lang == "en":
        return en
    return deep_merge(en, json.load(open(os.path.join(ROOT, "copy", f"{lang}.json"))))


# ---------------------------------------------------------------- media helpers
def picture(slot, alt, sizes, img_class="", lazy=True, fetchpriority=None,
            media_pair=None):
    """Build a <picture> with AVIF/WebP/JPEG srcsets from the manifest.
    media_pair: optional (mobile_slot, media_query) for art-directed heroes."""
    man = IMGS[slot]
    widths = man["widths"]
    biggest = widths[-1]

    def srcset(s, ext):
        return ", ".join(f"/assets/img/{s}-{w['w']}.{ext} {w['w']}w" for w in IMGS[s]["widths"])

    sources = []
    if media_pair:
        m_slot, m_query = media_pair
        for ext, mime in (("avif", "image/avif"), ("webp", "image/webp"), ("jpg", "image/jpeg")):
            sources.append(f'<source media="{m_query}" type="{mime}" srcset="{srcset(m_slot, ext)}" sizes="100vw">')
    for ext, mime in (("avif", "image/avif"), ("webp", "image/webp")):
        sources.append(f'<source type="{mime}" srcset="{srcset(slot, ext)}" sizes="{sizes}">')
    attrs = [
        f'src="/assets/img/{slot}-{biggest["w"]}.jpg"',
        f'srcset="{srcset(slot, "jpg")}"',
        f'sizes="{sizes}"',
        f'alt="{esc(alt)}"',
        f'width="{biggest["w"]}"',
        f'height="{biggest["h"]}"',
        'decoding="async"',
    ]
    if lazy:
        attrs.append('loading="lazy"')
    if fetchpriority:
        attrs.append(f'fetchpriority="{fetchpriority}"')
    if img_class:
        attrs.append(f'class="{img_class}"')
    return "<picture>" + "".join(sources) + f'<img {" ".join(attrs)}></picture>'


def placeholder(slot_id, label, aspect):
    """§7c designed placeholder: charcoal fill, faint copper hairline, mono label.
    Holds the slot's exact final dimensions; dropping the real file in via
    src/process-images.sh changes nothing but the pixels."""
    return (
        f"<!-- IMAGE SLOT NOT YET SUPPLIED: {esc(slot_id)} — export from the official "
        f"@thecaveforhim account per README, do not substitute stock or AI imagery. -->"
        f'<div class="ph" style="aspect-ratio:{aspect}" role="img" aria-label="{esc(label)}">'
        f'<span class="num">{esc(slot_id)}<br>{esc(label)}</span></div>'
    )


ARROW = ('<svg class="arr" width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden="true">'
         '<path d="M0 6h16M11 1l5 5-5 5" stroke="currentColor" stroke-width="1.5"/></svg>')

IG_SVG = ('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
          '<rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="currentColor" stroke-width="1.5"/>'
          '<circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.5"/>'
          '<circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/></svg>')

FB_SVG = ('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
          '<path d="M13.5 21v-7h2.6l.4-3h-3V9.1c0-.9.3-1.6 1.7-1.6h1.4V4.8c-.3 0-1.2-.1-2.2-.1-2.2 0-3.9 1.4-3.9 4v2.2H8v3h2.5v7Z" fill="currentColor"/></svg>')

WA_SVG = ('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
          '<path d="M12 3.6a8.4 8.4 0 0 0-7.2 12.7L3.6 20.4l4.2-1.1A8.4 8.4 0 1 0 12 3.6Z" stroke="currentColor" stroke-width="1.5"/>'
          '<path d="M9.2 8.6c.2-.5.4-.5.6-.5h.5c.2 0 .4 0 .5.4l.7 1.7c.1.2 0 .4-.1.5l-.5.6c-.1.2-.1.3 0 .5.5.9 1.4 1.7 2.4 2.2.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.6.8c.3.1.4.3.4.5-.1.6-.5 1.3-1.3 1.5-.7.2-1.6.2-3.3-.7a8.6 8.6 0 0 1-3.3-3.4c-.6-1.1-.6-2 .2-3.2Z" fill="currentColor"/></svg>')


# ---------------------------------------------------------------- shared blocks

def mask_h2(text, extra=""):
    return f'<h2{extra}><span class="mask"><span>{esc(text)}</span></span></h2>'


def intro_veil():
    return ('<div class="intro" id="intro" aria-hidden="true">'
            '<div class="intro__inner">'
            '<div class="intro__mark"><img src="/assets/img/logo.svg" alt="" width="500" height="247"></div>'
            '<div class="intro__shop-cue" aria-hidden="true">'
            '<span class="intro__cut-line"></span>'
            '<svg class="intro__shears" width="30" height="20" viewBox="0 0 30 20" fill="none">'
            '<circle cx="5" cy="5" r="3.25" stroke="currentColor" stroke-width="1.4"/>'
            '<circle cx="5" cy="15" r="3.25" stroke="currentColor" stroke-width="1.4"/>'
            '<path d="M8 7.1 27 16M8 12.9 27 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
            '</svg><span class="intro__cut-line"></span></div>'
            '<p class="intro__status" data-intro-status role="status" aria-live="polite" aria-atomic="true">Preparing your chair</p>'
            '<div class="intro__progress" data-intro-progress aria-hidden="true">'
            '<span class="intro__progress-bar" data-intro-progress-bar></span></div>'
            '<div class="intro__desktop-rule" aria-hidden="true"></div>'
            '</div></div>')

def book_attrs(copy):
    return (f'href="{BIZ["booking_url"]}" target="_blank" rel="noopener noreferrer" '
            f'aria-label="{esc(copy["actions"]["book_aria"])}"')


def wa_attrs(copy):
    return (f'href="{BIZ["whatsapp_url"]}" target="_blank" rel="noopener noreferrer" '
            f'aria-label="{esc(copy["actions"]["whatsapp_aria"])}"')


def svc_name(svc, copy):
    """Service rows live in data/business.json — the price source of truth —
    and carry an "es" name alongside "en". A row with no translation falls
    back to English rather than disappearing from the menu."""
    return svc.get(copy["lang"]) or svc["en"]


def group_name(g, copy):
    """Group headings are translated in the copy layer (services_page.group_names)
    so the locale files stay the single place a translator has to work."""
    return copy["services_page"]["group_names"].get(g["id"], g.get("name_en", g["id"]))


def lang_switch(copy, path):
    """Same page, other language. Rendered from BUILD_LANGS so a third locale
    needs no markup change here, and both sides stay real links so the control
    works with no JavaScript."""
    if len(BUILD_LANGS) < 2:
        return ""
    ls = copy["lang_switch"]
    links = []
    for code in BUILD_LANGS:
        lc = load_copy(code)
        current = code == copy["lang"]
        links.append(
            f'<a href="/{lc["dir_prefix"]}{path}" hreflang="{lc["hreflang"]}" lang="{lc["hreflang"]}"'
            f'{" aria-current=\"true\"" if current else ""}'
            f' title="{esc(ls["to_" + code])}">{esc(ls[code])}</a>'
        )
    return (f'<div class="langsw" role="group" aria-label="{esc(ls["label"])}">'
            + '<span class="langsw__sep" aria-hidden="true"></span>'.join(links)
            + '</div>')


def header(copy, active, prefix, path=""):
    c = copy["nav"]
    items = [
        ("services", f"/{prefix}services/", c["services"]),
        ("experience", f"/{prefix}experience/", c["experience"]),
        ("gallery", f"/{prefix}gallery/", c["gallery"]),
        ("about", f"/{prefix}about/", c["about"]),
        ("findus", f"/{prefix}find-us/", c["findus"]),
    ]
    nav = "".join(
        f'<a href="{href}"{" aria-current=\"page\"" if key == active else ""}>{esc(label)}</a>'
        for key, href, label in items
    )
    mmenu_items = "".join(
        f'<li style="--i:{i}"><a class="mm-link" href="{href}"><span class="num">0{i + 1}</span>{esc(label)}</a></li>'
        for i, (key, href, label) in enumerate(items)
    )
    return f"""
<a class="skip" href="#main">{esc(c["skip"])}</a>
<header class="hdr">
  <div class="wrap hdr__in">
    <a class="hdr__logo" href="/{prefix if prefix else ""}" aria-label="{esc(copy["a11y"]["logo_home"].format(brand=BIZ["brand"]))}">
      <img src="/assets/img/logo.svg" alt="{esc(copy["a11y"]["logo_alt"].format(brand=BIZ["brand"]))}" width="500" height="247">
    </a>
    <nav class="hdr__nav" aria-label="{esc(copy["a11y"]["nav_main"])}">
      {nav}
      {lang_switch(copy, path)}
      <a class="btn btn--primary" {book_attrs(copy)}>{esc(c["book"])}</a>
      <button class="burger" aria-expanded="false" aria-controls="mmenu" aria-label="{esc(c["menu_open"])}"
              data-open-label="{esc(c["menu_open"])}" data-close-label="{esc(c["menu_close"])}">
        <span></span><span></span>
      </button>
    </nav>
  </div>
</header>
<div class="mmenu" id="mmenu" role="dialog" aria-modal="true" aria-label="{esc(copy["a11y"]["nav_menu"])}">
  <ol>{mmenu_items}</ol>
  <div class="mmenu__actions">
    <a class="btn btn--primary" {book_attrs(copy)}>{esc(copy["actions"]["book_long"])}</a>
    <a class="btn btn--ghost" {wa_attrs(copy)}>{WA_SVG}{esc(copy["actions"]["whatsapp"])}</a>
    {lang_switch(copy, path)}
  </div>
  <p class="mmenu__meta">
    <a href="{BIZ["phone_tel"]}">{esc(BIZ["phone_display"])}</a><br>
    {esc(BIZ["address"]["display_short"])}<br>
    <a href="{BIZ["instagram"]}" target="_blank" rel="noopener noreferrer">Instagram</a> ·
    <a href="{BIZ["facebook"]}" target="_blank" rel="noopener noreferrer">Facebook</a>
  </p>
</div>"""


def hours_rows(copy, mini=False):
    """Hours from the single source of truth, grouped for the footer or full for tables."""
    days = copy["status"]["days_long"]
    closed = copy["status"]["closed_word"]
    if mini:
        groups, cur = [], None
        for i, row in enumerate(BIZ["hours"]["week"]):
            key = (row["open"], row["close"])
            if cur and cur[0] == key:
                cur[2] = i
            else:
                cur = [key, i, i]
                groups.append(cur)
        out = []
        for (o, c), a, b in groups:
            label = days[a][:3] if a == b else f"{days[a][:3]}–{days[b][:3]}"
            out.append(f"<span>{esc(label)}</span> {esc(f'{o}–{c}' if o else closed)}")
        return "<br>".join(out)
    rows = []
    for i, row in enumerate(BIZ["hours"]["week"]):
        val = f"{row['open']} – {row['close']}" if row["open"] else closed
        rows.append(f'<tr data-day="{i}"><td>{esc(days[i])}</td><td>{esc(val)}</td></tr>')
    return "".join(rows)


HOURS_COMMENT = ("<!-- HOURS SOURCE: the business's official booking system "
                 "(home.shortcutssoftware.com/londonandcoandthecave). OWNER TO CONFIRM MONDAY "
                 "before launch: the old Spanish site said 'Lunes CERRADO', the booking system says "
                 "Monday 10:00-18:30, the shopfront sign reads 'Martes-Viernes'. "
                 "Edit hours ONLY in data/business.json, then rebuild. -->")

WA_COMMENT = "<!-- CONFIRM WHATSAPP NUMBER BEFORE LAUNCH — sourced from the business phone number (see data/business.json). -->"


def status_line(extra_class=""):
    return (f'<p class="status-line {extra_class}" data-status hidden>'
            f'<span class="dot" aria-hidden="true"></span><span class="status-txt"></span></p>')


def footer(copy, prefix):
    f = copy["footer"]
    a = BIZ["address"]
    return f"""
<footer class="ftr">
  <div class="wrap">
    <div class="ftr__grid">
      <div class="ftr__brand">
        <img src="/assets/img/logo.svg" alt="{esc(BIZ["brand"])} wordmark" width="500" height="247">
        <p>{esc(f["descriptor"])}</p>
        <p class="attributes">{esc(f["attributes_line"])}</p>
      </div>
      <div>
        <h4>{esc(f["col_visit"])}</h4>
        <address>{esc(a["street"])}<br>{esc(a["area"])}<br>{esc(a["locality"])}, {esc(a["region"])} {esc(a["postcode"])}</address>
        <ul><li><a href="{BIZ["directions_url"]}" target="_blank" rel="noopener noreferrer">{esc(copy["actions"]["directions"])}</a></li></ul>
      </div>
      <div>
        <h4>{esc(f["col_contact"])}</h4>
        <ul>
          <li><a href="{BIZ["phone_tel"]}">{esc(BIZ["phone_display"])}</a></li>
          {WA_COMMENT}
          <li><a {wa_attrs(copy)}>WhatsApp</a></li>
          <li><a href="mailto:{BIZ["email"]}">{esc(BIZ["email"])}</a></li>
          <li><a href="/{prefix}careers/">{esc(f["careers"])}</a></li>
        </ul>
      </div>
      <div>
        <h4>{esc(f["col_hours"])}</h4>
        {HOURS_COMMENT}
        <p class="hours-mini">{hours_rows(copy, mini=True)}</p>
        {status_line()}
      </div>
    </div>
    <div class="ftr__base">
      <div class="ftr__social">
        <a href="{BIZ["instagram"]}" target="_blank" rel="noopener noreferrer" aria-label="{esc(copy["a11y"]["instagram"].format(brand=BIZ["brand"]))}">{IG_SVG}</a>
        <a href="{BIZ["facebook"]}" target="_blank" rel="noopener noreferrer" aria-label="{esc(copy["a11y"]["facebook"].format(brand=BIZ["brand"]))}">{FB_SVG}</a>
      </div>
      <a href="/{prefix}legal/privacy/">{esc(f["privacy"])}</a>
      <a href="/{prefix}legal/cookies/">{esc(f["cookies"])}</a>
      <span class="spacer"></span>
      <a href="{BIZ["sister"]["url"]}" target="_blank" rel="noopener noreferrer">{esc(f["sister_line"])}</a>
      <span>© <span data-year>2026</span> {esc(BIZ["brand"])}</span>
    </div>
  </div>
</footer>
<!-- Starts hidden off-screen; main.js keeps visual state, aria-hidden, tab order
     and inert in sync. Without JS the bar never appears (CSS hides it), so the
     static state below is the accessible truth. -->
<div class="stickybar" aria-hidden="true">
  <a class="btn btn--primary" tabindex="-1" {book_attrs(copy)}>{esc(copy["nav"]["book"])}</a>
  <a class="btn btn--ghost" tabindex="-1" {wa_attrs(copy)}>{WA_SVG}WhatsApp</a>
</div>"""


def jsonld(copy):
    groups = []
    for g in BIZ["service_groups"]:
        groups.append({
            "@type": "OfferCatalog",
            "name": group_name(g, copy),
            "itemListElement": [
                {
                    "@type": "Offer",
                    "itemOffered": {"@type": "Service", "name": svc_name(s, copy)},
                    "priceSpecification": {
                        "@type": "PriceSpecification",
                        "minPrice": s["from"],
                        "priceCurrency": "EUR",
                    },
                } for s in g["services"]
            ],
        })
    a = BIZ["address"]
    data = {
        "@context": "https://schema.org",
        "@type": ["HairSalon", "BarberShop", "LocalBusiness"],
        "name": BIZ["brand"],
        "alternateName": "The Cave For Him",
        "description": copy["meta"]["home_desc"],
        "url": BASE + "/",
        "telephone": "+34603555121",
        "email": BIZ["email"],
        "image": BASE + "/assets/img/og-image.jpg",
        "logo": BASE + "/assets/img/logo.png",
        "priceRange": "€€",
        "currenciesAccepted": "EUR",
        "address": {
            "@type": "PostalAddress",
            "streetAddress": f"{a['street']}, {a['area']}",
            "addressLocality": a["locality"],
            "addressRegion": a["region"],
            "postalCode": a["postcode"],
            "addressCountry": a["country"],
        },
        "geo": {"@type": "GeoCoordinates", "latitude": BIZ["geo"]["lat"], "longitude": BIZ["geo"]["lng"]},
        "hasMap": BIZ["map_url"],
        "openingHoursSpecification": [
            {"@type": "OpeningHoursSpecification",
             "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
             "opens": "10:00", "closes": "18:30"},
            {"@type": "OpeningHoursSpecification", "dayOfWeek": "Saturday",
             "opens": "10:00", "closes": "16:00"},
        ],
        "sameAs": [BIZ["instagram"], BIZ["facebook"]],
        "hasOfferCatalog": {"@type": "OfferCatalog", "name": "Barbering services",
                            "itemListElement": groups},
        "potentialAction": {
            "@type": "ReserveAction",
            "target": {"@type": "EntryPoint", "urlTemplate": BIZ["booking_url"],
                       "inLanguage": "en",
                       "actionPlatform": ["http://schema.org/DesktopWebPlatform",
                                          "http://schema.org/MobileWebPlatform"]},
            "result": {"@type": "Reservation", "name": "Barbershop appointment"},
        },
        "areaServed": ["La Cala de Mijas", "Mijas Costa", "Mijas", "Fuengirola", "Marbella"],
    }
    note = ("<!-- AggregateRating is intentionally absent until the owner confirms the live Google "
            "figure on launch day; the UI value lives in data/business.json (rating block). -->")
    return note + '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + "</script>"


def shell(copy, prefix, path, title, desc, body, active="", is_home=False, preload_hero=False):
    canonical = f"{BASE}/{prefix}{path}"
    hreflangs = []
    for lang in BUILD_LANGS:
        lc = load_copy(lang)
        hreflangs.append(f'<link rel="alternate" hreflang="{lc["hreflang"]}" href="{BASE}/{lc["dir_prefix"]}{path}">')
    hreflangs.append(f'<link rel="alternate" hreflang="x-default" href="{BASE}/{path}">')

    critical = open(os.path.join(ROOT, "assets", "css", "fonts.css")).read() + \
        open(os.path.join(ROOT, "assets", "css", "critical.css")).read()
    # fonts.css paths are relative to /assets/css/; inlined in <head> they must be absolute
    critical = critical.replace("url('../fonts/", "url('/assets/fonts/")

    preloads = [
        '<link rel="preload" href="/assets/fonts/antonio-600-latin.woff2" as="font" type="font/woff2" crossorigin>',
        '<link rel="preload" href="/assets/fonts/inter-400-latin.woff2" as="font" type="font/woff2" crossorigin>',
        '<link rel="preload" href="/assets/fonts/jetbrains-mono-400-latin.woff2" as="font" type="font/woff2" crossorigin>',
    ]
    if preload_hero:
        hero_m = IMGS["cave-hero-mobile"]["widths"][-1]
        hero_d = IMGS["cave-hero"]["widths"][-1]
        m_set = ", ".join(f"/assets/img/cave-hero-mobile-{w['w']}.avif {w['w']}w" for w in IMGS["cave-hero-mobile"]["widths"])
        preloads.append(f'<link rel="preload" as="image" imagesrcset="{m_set}" imagesizes="100vw" media="(max-width: 899px)" fetchpriority="high">')
        d_set = ", ".join(f"/assets/img/cave-hero-{w['w']}.avif {w['w']}w" for w in IMGS["cave-hero"]["widths"])
        preloads.append(f'<link rel="preload" as="image" imagesrcset="{d_set}" imagesizes="100vw" media="(min-width: 900px) and (max-width: 1023px)" fetchpriority="high">')
        preloads.append('<link rel="preload" as="image" href="/assets/img/scrub-poster.webp" media="(min-width: 1024px)" fetchpriority="high">')

    cave_data = {
        "hours": BIZ["hours"]["week"],
        "str": {
            "open_until": copy["status"]["open_until"],
            "closed_now": copy["status"]["closed_now"],
            "closed_today": copy["status"]["closed_today"],
            "days_long": copy["status"]["days_long"],
            "today_word": copy["status"]["today_word"],
        },
    }

    global ASSET_V
    if ASSET_V is None:
        ASSET_V = asset_v()
    av = ASSET_V

    # The 4000ms tail is the phone film's download budget: the veil waits for a
    # fully downloaded, first-frame-painted film (main.js dispatches
    # cave:hero-ready), and this timer is the hard stop that gives up on it,
    # aborts the fetch and hands the visitor the photographic hero instead.
    # Nothing may make a visitor wait longer than this.
    #
    # Was 6000ms against a 6.06MB cut, which needed ~8Mbps just to finish in
    # time — so slower visitors paid the full six seconds and were handed the
    # photograph anyway. The cut is now 2.39MB, so 4000ms clears it at ~4.8Mbps
    # and most phones land it in well under half the budget. Shorter wait, and
    # more visitors actually get the film.
    boot_script = ("(function(d){d.classList.remove('no-js');var noAnim=/[?&]noanim/.test(location.search),"
                   "reduce=matchMedia('(prefers-reduced-motion: reduce)').matches,"
                   "phone=matchMedia('(max-width: 899px) and (orientation: portrait) and (pointer: coarse)').matches,"
                   "c=navigator.connection||{},slow=c.saveData||/(^| )(slow-2g|2g|3g)( |$)/.test(c.effectiveType||'');"
                   "if(!noAnim)d.classList.add('js');if(!noAnim&&!reduce&&phone&&!slow){d.classList.add('hero-loading');"
                   "window.__caveHeroGateTimer=setTimeout(function(){try{document.dispatchEvent(new CustomEvent('cave:hero-fallback'));}"
                   "catch(e){}setTimeout(function(){d.classList.remove('hero-loading');var i=document.getElementById('intro');"
                   "if(i)i.remove();},360);},4000);}})(document.documentElement);"
                   if is_home else
                   "document.documentElement.classList.remove('no-js');if(!/[?&]noanim/.test(location.search))document.documentElement.classList.add('js');")

    return f"""<!DOCTYPE html>
<html lang="{copy["lang"]}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canonical}">
{"".join(hreflangs)}
<meta name="theme-color" content="#0D0D0C">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{esc(BIZ["brand"])}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{BASE}/assets/img/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="{"es_ES" if copy["lang"] == "es" else "en_GB"}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(desc)}">
<meta name="twitter:image" content="{BASE}/assets/img/og-image.jpg">
<link rel="icon" href="/assets/img/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/assets/img/favicon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
{"".join(preloads)}
<style>{critical}</style>
<link rel="stylesheet" href="/assets/css/main.css?v={av}" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="/assets/css/main.css?v={av}"></noscript>
<script>{boot_script}</script>
{jsonld(copy) if is_home else ""}
</head>
<body>
{intro_veil() if is_home else ""}
{header(copy, active, prefix, path)}
<main id="main">
{body}
</main>
{footer(copy, prefix)}
<script id="cave-data" type="application/json">{json.dumps(cave_data, ensure_ascii=False)}</script>
<script src="/assets/js/main.js?v={av}" defer></script>
</body>
</html>"""


# ---------------------------------------------------------------- home sections
def sec_hero(copy):
    h = copy["hero"]
    rating = BIZ["rating"]
    # Desktop (>=1024px) paints the ink-sketch scrub poster; the scroll film fades
    # in over its own first frame. Tablet/mobile keep the real photography.
    pic = picture("cave-hero", h["hero_alt"], "100vw", lazy=False, fetchpriority="high",
                  media_pair=("cave-hero-mobile", "(max-width: 899px)"))
    sketch_sources = ('<source media="(min-width: 1024px)" type="image/webp" srcset="/assets/img/scrub-poster.webp">'
                      '<source media="(min-width: 1024px)" type="image/jpeg" srcset="/assets/img/scrub-poster.jpg">'
                      '<source media="(max-width: 899px) and (orientation: portrait) and (prefers-reduced-motion: no-preference)" '
                      'type="image/webp" srcset="/assets/img/cave-scroll-mobile-poster.webp">'
                      '<source media="(max-width: 899px) and (orientation: portrait) and (prefers-reduced-motion: no-preference)" '
                      'type="image/jpeg" srcset="/assets/img/cave-scroll-mobile-poster.jpg">')
    pic = pic.replace("<picture>", "<picture>" + sketch_sources, 1)
    return f"""
<section class="hero" data-scrub-src="/assets/video/cave-scroll.mp4" data-scrub-runway="200"
         data-scrub-src-mobile="/assets/video/cave-scroll-mobile.mp4?v=20260816-1" data-scrub-runway-mobile="300">
  <div class="hero__stage">
    <div class="hero__media" data-ambient="/assets/video/cave-ambient-web.mp4" data-ambient-poster="/assets/img/cave-hero-768.jpg">
      {pic}
      <div class="hero__film" hidden></div>
    </div>
    <div class="hero__content wrap">
      <div class="hero__grid"><div class="hero__inner">
        <div class="hero__act1group">
          <span class="label">{esc(h["eyebrow"])}</span>
          <h1>
            <span class="mask"><span>{esc(h["h1_l1"])}</span></span>
            <span class="mask" style="transition-delay:80ms"><span>{esc(h["h1_l2"])}</span></span>
          </h1>
          <p class="hero__lead">{esc(h["lead"])}</p>
        </div>
        {WA_COMMENT}
        <div class="hero__persist">
          <div class="hero__cta">
            <a class="btn btn--primary" {book_attrs(copy)}>{esc(copy["actions"]["book_long"])}{ARROW}</a>
            <a class="btn btn--copper" {wa_attrs(copy)}>{WA_SVG}{esc(copy["actions"]["whatsapp"])}</a>
          </div>
          <p class="hero__micro num">{esc(copy["actions"]["booking_micro"])}</p>
        </div>
        <div class="hero__meta hero__act1group">
          <span>{esc(BIZ["address"]["display_short"])}</span>
          <span data-status hidden><span class="dot" aria-hidden="true"></span><span class="status-txt"></span></span>
          <a href="{BIZ["map_url"]}" target="_blank" rel="noopener noreferrer">{esc(h["rating_label"].replace("{v}", rating["value"]))}</a>
        </div>
      </div></div>
    </div>
    <div class="hero__act hero__act--2 wrap" aria-hidden="true">
      <p class="hero__act-line">{esc(h["act2_line"])}</p>
      <span class="label">{esc(BIZ["address"]["display_short"])}</span>
    </div>
    <div class="hero__act hero__act--3 wrap" aria-hidden="true">
      <p class="hero__act-line">{esc(h["act3_line"])}</p>
    </div>
    <div class="hero__hint num" aria-hidden="true">{esc(h["scroll_hint"])}</div>
  </div>
</section>"""


def sec_statement(copy):
    p = copy["statement"]["body_parts"]
    body = (esc(p[0]) + f'<span class="lift">{esc(p[1])}</span>' + esc(p[2]) +
            f'<span class="lift">{esc(p[3])}</span>')
    return f"""
<section class="sec">
  <span class="sec-num-side">{esc(copy["statement"]["label"])}</span>
  <div class="wrap statement" data-reveal>
    <span class="num">{esc(copy["statement"]["label"])}</span>
    <p>{body}</p>
  </div>
</section>"""


def svc_rows(copy, group_ids):
    s = copy["services_home"]
    rows = []
    for gid in group_ids:
        g = next(x for x in BIZ["service_groups"] if x["id"] == gid)
        for svc in g["services"]:
            rows.append(f"""
      <a class="svc-row" {book_attrs(copy)}>
        <span class="s-name">{esc(svc_name(svc, copy))}</span>
        <span class="s-time">{svc["min"]} {esc(s["min"])}</span>
        <span class="s-price"><span class="s-from">{esc(s["from"])}</span>{svc["from"]}&nbsp;€</span>
        <span class="s-arr" aria-hidden="true">{ARROW}</span>
      </a>""")
    return "".join(rows)


def sec_services(copy, prefix):
    s = copy["services_home"]
    groups_html = []
    for i, hg in enumerate(BIZ["home_groups"]):
        gid = f"svcg-{i}"
        groups_html.append(f"""
    <div class="svc-group{' open' if i == 0 else ' open'}">
      <button class="svc-group__head" aria-expanded="true" aria-controls="{gid}">
        <span class="num">{hg["num"]}</span>
        <span class="g-name">{esc(s[hg["label_key"]])}</span>
        <span class="g-cross" aria-hidden="true"></span>
      </button>
      <div class="svc-group__panel" id="{gid}"><div>
        {svc_rows(copy, hg["group_ids"])}
      </div></div>
    </div>""")
    return f"""
<section class="sec sec--charcoal" id="services">
  <span class="sec-num-side">{esc(copy["services_home"]["label"])}</span>
  <div class="wrap svc-layout">
    <div class="svc-left" data-reveal>
      <span class="num">{esc(s["label"])}</span>
      {mask_h2(s["h2"])}
      <a class="btn btn--ghost" href="/{prefix}services/">{esc(copy["actions"]["view_services"])}{ARROW}</a>
    </div>
    <div class="svc-right" data-reveal style="--i:1">
      {"".join(groups_html)}
      <p class="svc-note">{esc(s["note"])}</p>
    </div>
  </div>
</section>"""


def sec_experience(copy):
    e = copy["experience"]
    pillars = "".join(f"""
      <div class="pillar" data-reveal style="--i:{i}">
        <span class="num">{p["n"]}</span>
        <div><h3>{esc(p["h"])}</h3><p>{esc(p["p"])}</p></div>
      </div>""" for i, p in enumerate(e["pillars"]))
    return f"""
<section class="sec sec--ivory exp" id="experience">
  <div class="wrap exp__grid">
    <div class="exp__media">
      {picture("experience-room", e["room_alt"], "(min-width: 900px) 45vw, 100vw")}
    </div>
    <div class="exp__body">
      <span class="num">{esc(e["label"])}</span>
      {mask_h2(e["h2"])}
      {pillars}
      <p class="pullquote" data-reveal>{esc(e["quote"])}</p>
    </div>
  </div>
</section>"""


def sec_break(copy):
    b = copy["break"]
    return f"""
<section class="break">
  {picture("visual-break", b["alt"], "100vw")}
  <h2><span class="mask"><span>{esc(b["statement"])}</span></span></h2>
</section>"""


def sec_barbers(copy):
    b = copy["barbers"]
    cards = "".join(f"""
    <div class="barber-card" data-reveal style="--i:{i}">
      <span class="num">0{i + 1}</span>
      <h3>{esc(name)}</h3>
      <span class="role">{esc(b["role"])}</span>
      <a class="book-with" {book_attrs(copy)}>{esc(b["book_with"].replace("{name}", name))}{ARROW}</a>
    </div>""" for i, name in enumerate(BIZ["barbers"]))
    return f"""
<section class="sec" id="barbers">
  <span class="sec-num-side">{esc(copy["barbers"]["label"])}</span>
  <div class="wrap">
    <div class="sec-head"><span class="num">{esc(b["label"])}</span>{mask_h2(b["h2"])}<span class="rule"></span></div>
    <div class="barbers__grid">{cards}</div>
  </div>
</section>"""


def work_tile(copy, slot, cls, idx):
    cap = copy["work"]["captions"][slot]
    post = BIZ["gallery_posts"][slot]
    # phone term matches the real rendered width (odd tiles 85%, even tiles 60%
    # of the gutter-trimmed viewport) so Safari doesn't fetch oversized candidates;
    # the desktop 33vw term is unchanged.
    phone_w = "58vw" if idx % 2 else "82vw"
    return f"""
    <a class="tile {cls}" href="{post}" target="_blank" rel="noopener noreferrer"
       aria-label="{esc(cap)} — {esc(copy["work"]["tile_aria"])}" data-reveal style="--i:{idx}">
      {picture(slot, cap, f"(min-width: 900px) 33vw, {phone_w}")}
      <span class="cap" aria-hidden="true">{esc(cap)}</span>
    </a>"""


def sec_work(copy, prefix):
    w = copy["work"]
    tiles = "".join(work_tile(copy, f"work-0{i + 1}", f"t-{i + 1}", i) for i in range(6))
    ph = ""
    return f"""
<section class="sec sec--charcoal work" id="work">
  <span class="sec-num-side">{esc(copy["work"]["label"])}</span>
  <div class="wrap">
    <div class="sec-head"><span class="num">{esc(w["label"])}</span>{mask_h2(w["h2"])}<span class="rule"></span></div>
    <div class="work__grid">{tiles}{ph}</div>
    <div class="work__cta"><a class="mono-link" href="/{prefix}gallery/">{esc(copy["actions"]["view_gallery"])}{ARROW}</a></div>
  </div>
</section>"""


def sec_social(copy):
    s = copy["social"]
    slots = ["work-03", "work-04", "cave-hero-mobile", "work-01"]
    items = "".join(f"""
      <div class="strip__item">{picture(slot, s["alts"][i], "min(68vw, 360px)")}</div>"""
                    for i, slot in enumerate(slots))
    return f"""
<section class="sec social" id="social">
  <span class="sec-num-side">{esc(copy["social"]["label"])}</span>
  <div class="wrap social__head">
    <span class="num">{esc(s["label"])}</span>
    {mask_h2(s["h2"])}
    <p class="social__line">{esc(s["line"])}</p>
  </div>
  <div class="strip" data-drag tabindex="0" role="group" aria-label="{esc(s["h2"])}">{items}</div>
  <div class="wrap social__cta">
    <a class="btn btn--ghost" href="{BIZ["instagram"]}" target="_blank" rel="noopener noreferrer">{IG_SVG}{esc(copy["actions"]["follow"])}</a>
  </div>
</section>"""


def find_block(copy, full_page=False):
    f = copy["findus"]
    a = BIZ["address"]
    note = f'<p class="svc-note">{esc(f["page_note"])}</p>' if full_page else ""
    return f"""
  <div class="wrap find__grid">
    <div class="find">
      <address>{esc(a["street"])}<br>{esc(a["area"])}<br>{esc(a["locality"])}, {esc(a["region"])} {esc(a["postcode"])}</address>
      <p class="caption" style="margin-top:12px">{esc(f["plus_code"])}: {esc(BIZ["geo"]["plus_code"])}</p>
      {status_line()}
      <span class="label">{esc(f["hours_h"])}</span>
      {HOURS_COMMENT}
      <table class="hours"><tbody>{hours_rows(copy)}</tbody></table>
      <span class="label">{esc(f["contact_h"])}</span>
      <ul class="find__contact">
        <li><a href="{BIZ["phone_tel"]}">{esc(BIZ["phone_display"])}</a></li>
        {WA_COMMENT}
        <li><a {wa_attrs(copy)}>WhatsApp · {esc(BIZ["phone_display"])}</a></li>
        <li><a href="mailto:{BIZ["email"]}">{esc(BIZ["email"])}</a></li>
      </ul>
      {note}
      <a class="btn btn--primary" href="{BIZ["directions_url"]}" target="_blank" rel="noopener noreferrer">{esc(copy["actions"]["directions"])}{ARROW}</a>
    </div>
    <div class="find__media" data-reveal>
      {picture("storefront", f["storefront_alt"], "(min-width: 900px) 50vw, 100vw")}
      <p class="caption">{esc(a["display_full"])}</p>
    </div>
  </div>"""


def sec_find(copy):
    f = copy["findus"]
    return f"""
<section class="sec sec--charcoal" id="find-us">
  <span class="sec-num-side">{esc(copy["findus"]["label"])}</span>
  <div class="wrap">
    <div class="sec-head"><span class="num">{esc(f["label"])}</span>{mask_h2(f["h2"])}<span class="rule"></span></div>
  </div>
  {find_block(copy)}
</section>"""


def sec_final(copy):
    fi = copy["final"]
    return f"""
<section class="sec final" id="book">
  <div class="wrap">
    {mask_h2(fi["h2"])}
    <p>{esc(fi["line"])}</p>
    <div class="final__cta">
      <a class="btn btn--primary" {book_attrs(copy)}>{esc(copy["actions"]["book_final"])}{ARROW}</a>
      <a class="btn btn--ghost" {wa_attrs(copy)}>{WA_SVG}{esc(copy["actions"]["whatsapp"])}</a>
    </div>
    <p class="reassure">{esc(copy["actions"]["booking_reassure"])}</p>
  </div>
</section>"""


def page_home(copy, prefix):
    body = (sec_hero(copy) + sec_statement(copy) + sec_services(copy, prefix) +
            sec_experience(copy) + sec_break(copy) + sec_barbers(copy) +
            sec_work(copy, prefix) + sec_social(copy) + sec_find(copy) + sec_final(copy))
    return shell(copy, prefix, "", copy["meta"]["home_title"], copy["meta"]["home_desc"],
                 body, active="", is_home=True, preload_hero=True)


# ---------------------------------------------------------------- inner pages
def page_head(copy, num_label, h1, intro=""):
    intro_html = f'<p class="intro">{esc(intro)}</p>' if intro else ""
    return f"""
<div class="page-head wrap">
  <span class="num">{esc(num_label)}</span>
  <h1><span class="mask in"><span>{esc(h1)}</span></span></h1>
  {intro_html}
</div>"""


def page_services(copy, prefix):
    sp = copy["services_page"]
    s = copy["services_home"]
    media_map = {"cuts": "svc-cut", "beard": "svc-beard", "shave": "svc-shave",
                 "detail": "svc-detail", "cut-beard": "svc-combo"}
    blocks = []
    for i, g in enumerate(BIZ["service_groups"]):
        rows = "".join(f"""
        <tr>
          <td>{esc(svc_name(svc, copy))}</td>
          <td class="t-time">{svc["min"]} {esc(s["min"])}</td>
          <td class="t-price"><span class="s-from">{esc(s["from"])}</span>{svc["from"]}&nbsp;€</td>
        </tr>""" for svc in g["services"])
        slot = media_map.get(g["id"])
        if slot:
            media = picture(slot, sp["svc_alts"][slot], "(min-width: 900px) 380px, 100vw")
        else:
            media = placeholder("IMG-SVC-COMBO", "Cut and beard in one sitting · 3:4", "3 / 4")
        blocks.append(f"""
    <div class="menu-group" data-reveal>
      <div class="menu-group__media">{media}</div>
      <table class="menu-table">
        <caption><span class="num">0{i + 1}</span>{esc(group_name(g, copy))}</caption>
        <thead><tr><th scope="col">{esc(sp["th_service"])}</th><th scope="col">{esc(sp["th_time"])}</th><th scope="col">{esc(sp["th_from"])}</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>""")
    body = page_head(copy, sp["eyebrow"], sp["h1"], sp["intro"]) + f"""
<div class="wrap">
  {"".join(blocks)}
  <p class="svc-note">{esc(sp["note"])}</p>
  <p class="reassure svc-note">{esc(copy["actions"]["booking_reassure"])}</p>
  <div class="hero__cta" style="margin-top:40px">
    <a class="btn btn--primary" {book_attrs(copy)}>{esc(copy["actions"]["book_long"])}{ARROW}</a>
    <a class="btn btn--ghost" {wa_attrs(copy)}>{WA_SVG}{esc(copy["actions"]["whatsapp"])}</a>
  </div>
  <div style="height:var(--pad-sec)"></div>
</div>"""
    return shell(copy, prefix, "services/", copy["meta"]["services_title"],
                 copy["meta"]["services_desc"], body, active="services")


def page_experience(copy, prefix):
    e = copy["experience"]
    pillars = "".join(f"""
      <div class="pillar" data-reveal style="--i:{i}">
        <span class="num">{p["n"]}</span>
        <div><h3>{esc(p["h"])}</h3><p>{esc(p["p"])}</p></div>
      </div>""" for i, p in enumerate(e["pillars"]))
    body = page_head(copy, e["label"], e["h2"], e["page_intro"]) + f"""
<section class="sec sec--ivory exp" style="padding-top:clamp(3rem,7vh,5rem)">
  <div class="wrap exp__grid">
    <div class="exp__media">
      {picture("experience-room", e["room_alt"], "(min-width: 900px) 45vw, 100vw")}
    </div>
    <div class="exp__body">
      {pillars}
      <p class="pullquote" data-reveal>{esc(e["quote"])}</p>
    </div>
  </div>
</section>
<section class="sec">
  <div class="wrap exp__pair">
    <figure class="exp__plate" data-reveal>
      {picture("svc-shave", e["poster_alt"], "(min-width: 1180px) 520px, (min-width: 900px) 45vw, 100vw")}
      <figcaption class="caption">{esc(e["page_video_note"])}</figcaption>
    </figure>
    <figure class="exp__plate" data-reveal style="--i:1">
      {picture("experience-consult", e["consult_alt"], "(min-width: 1180px) 520px, (min-width: 900px) 45vw, 100vw")}
    </figure>
  </div>
</section>
<section class="sec final">
  <div class="wrap">
    {mask_h2(copy["final"]["h2"])}
    <p>{esc(copy["final"]["line"])}</p>
    <div class="final__cta">
      <a class="btn btn--primary" {book_attrs(copy)}>{esc(copy["actions"]["book_final"])}{ARROW}</a>
      <a class="btn btn--ghost" {wa_attrs(copy)}>{WA_SVG}{esc(copy["actions"]["whatsapp"])}</a>
    </div>
  </div>
</section>"""
    return shell(copy, prefix, "experience/", copy["meta"]["experience_title"],
                 copy["meta"]["experience_desc"], body, active="experience")


def page_gallery(copy, prefix):
    gp = copy["gallery_page"]
    w = copy["work"]
    tiles = []
    for i in range(6):
        slot = f"work-0{i + 1}"
        cap = w["captions"][slot]
        tiles.append(f"""
    <a class="tile g-{i + 1}" href="{BIZ["gallery_posts"][slot]}" target="_blank" rel="noopener noreferrer"
       aria-label="{esc(cap)} — {esc(w["tile_aria"])}" data-reveal style="--i:{i % 3}">
      {picture(slot, cap, f"(min-width: 900px) 40vw, {'58vw' if i % 2 else '82vw'}")}
      <span class="cap" aria-hidden="true">{esc(cap)}</span>
    </a>""")
    body = page_head(copy, w["label"], gp["h1"], gp["intro"]) + f"""
<div class="wrap">
  <div class="gal-grid">{"".join(tiles)}</div>
  <div class="work__cta">
    <a class="btn btn--ghost" href="{BIZ["instagram"]}" target="_blank" rel="noopener noreferrer">{IG_SVG}{esc(copy["actions"]["follow"])}</a>
  </div>
  <div style="height:var(--pad-sec)"></div>
</div>"""
    return shell(copy, prefix, "gallery/", copy["meta"]["gallery_title"],
                 copy["meta"]["gallery_desc"], body, active="gallery")


def page_about(copy, prefix):
    ap = copy["about_page"]
    r = BIZ["rating"]
    rating_line = ap["rating_line"].replace("{v}", r["value"]).replace("{c}", str(r["count"]))
    body = page_head(copy, ap["eyebrow"], ap["h1"]) + f"""
<div class="wrap about-body">
  <div class="prose">
    <p>{esc(ap["p1"])}</p>
    <p>{esc(ap["p2"])}</p>
    <p>{esc(ap["p3"])}</p>
    <p>{esc(ap["attributes_intro"])}</p>
    <p class="meta-line"><a href="{BIZ["map_url"]}" target="_blank" rel="noopener noreferrer">{esc(rating_line)}</a></p>
    <p class="display" style="border-top:1px solid var(--cave-hairline);padding-top:32px;font-size:var(--fs-h3);color:var(--cave-copper-300)">{esc(ap["cta_line"])}</p>
    <div class="hero__cta">
      <a class="btn btn--primary" {book_attrs(copy)}>{esc(copy["actions"]["book_long"])}{ARROW}</a>
    </div>
  </div>
  <div class="about-media" data-reveal>
    {picture("cave-hero-mobile", copy["hero"]["hero_alt"], "(min-width: 900px) 34vw, 100vw")}
  </div>
</div>"""
    return shell(copy, prefix, "about/", copy["meta"]["about_title"],
                 copy["meta"]["about_desc"], body, active="about")


def page_findus(copy, prefix):
    f = copy["findus"]
    body = page_head(copy, f["label"], f["h2"]) + find_block(copy, full_page=True) + \
        '<div style="height:var(--pad-sec)"></div>'
    return shell(copy, prefix, "find-us/", copy["meta"]["findus_title"],
                 copy["meta"]["findus_desc"], body, active="findus")


def page_careers(copy, prefix):
    cp = copy["careers_page"]
    body = page_head(copy, cp["eyebrow"], cp["h1"], cp["p1"]) + f"""
<div class="wrap careers-grid">
  <div>
    <p style="max-width:44ch">{esc(cp["p2"])}</p>
    <p class="form-note">{esc(cp["f_note"])}</p>
    <p style="margin-top:24px"><a class="mono-link" href="mailto:{BIZ["email"]}?subject={esc(cp["f_subject"])}">{esc(BIZ["email"])}{ARROW}</a></p>
  </div>
  <form id="careers-form" novalidate
        data-email="{BIZ["email"]}" data-subject="{esc(cp["f_subject"])}"
        data-err="{esc(cp["f_error_required"])}" data-ok="{esc(cp["f_ok"])}">
    <div class="form-field">
      <label for="cf-name">{esc(cp["f_name"])}</label>
      <input id="cf-name" name="name" type="text" autocomplete="name" required aria-describedby="form-status">
    </div>
    <div class="form-field">
      <label for="cf-phone">{esc(cp["f_phone"])}</label>
      <input id="cf-phone" name="phone" type="tel" autocomplete="tel">
    </div>
    <div class="form-field">
      <label for="cf-msg">{esc(cp["f_msg"])}</label>
      <textarea id="cf-msg" name="message" required aria-describedby="cf-msg-hint form-status"></textarea>
      <p class="hint" id="cf-msg-hint">{esc(cp["f_msg_hint"])}</p>
    </div>
    <button class="btn btn--primary" type="submit">{esc(cp["f_submit"])}{ARROW}</button>
    <p class="form-status" id="form-status" role="status" aria-live="polite"></p>
    <noscript><p class="form-note">JavaScript is off in your browser. Email us directly at
      <a href="mailto:{BIZ["email"]}">{BIZ["email"]}</a>.</p></noscript>
  </form>
</div>"""
    return shell(copy, prefix, "careers/", copy["meta"]["careers_title"],
                 copy["meta"]["careers_desc"], body, active="")


def page_legal(copy, prefix, which):
    lp = copy["legal_privacy" if which == "privacy" else "legal_cookies"]
    secs = "".join(f"<h2>{esc(s['h'])}</h2><p>{esc(s['p'])}</p>" for s in lp["sections"])
    body = page_head(copy, copy["legal_eyebrow"], lp["h1"]) + f"""
<div class="wrap legal-body">
  <p class="updated">{esc(lp["updated"])}</p>
  {secs}
</div>"""
    title = copy["meta"][f"{which}_title"]
    desc = copy["meta"][f"{which}_desc"]
    return shell(copy, prefix, f"legal/{which}/", title, desc, body, active="")


def page_404(copy, prefix):
    nf = copy["notfound"]
    body = f"""
<div class="nf">
  <div>
    <span class="code">{esc(nf["code"])}</span>
    <h1>{esc(nf["h1"])}</h1>
    <p>{esc(nf["p"])}</p>
    <div class="final__cta">
      <a class="btn btn--primary" {book_attrs(copy)}>{esc(copy["actions"]["book_long"])}{ARROW}</a>
      <a class="btn btn--ghost" href="/{prefix}find-us/">{esc(nf["find"])}</a>
    </div>
    <p style="margin-top:32px"><a class="mono-link" href="/{prefix if prefix else ""}">{esc(copy["actions"]["back_home"])}{ARROW}</a></p>
  </div>
</div>"""
    return shell(copy, prefix, "404.html", copy["meta"]["notfound_title"],
                 copy["meta"]["home_desc"], body, active="")


# ---------------------------------------------------------------- write it all
PAGES = [
    ("", page_home),
    ("services/", page_services),
    ("experience/", page_experience),
    ("gallery/", page_gallery),
    ("about/", page_about),
    ("find-us/", page_findus),
    ("careers/", page_careers),
    ("legal/privacy/", lambda c, p: page_legal(c, p, "privacy")),
    ("legal/cookies/", lambda c, p: page_legal(c, p, "cookies")),
]


def write(path, content):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True) if os.path.dirname(full) else None
    with open(full, "w", encoding="utf-8") as fh:
        fh.write(content)
    print(f"  {path}")


def main():
    print("Building The Cave →", ROOT)
    for lang in BUILD_LANGS:
        copy = load_copy(lang)
        prefix = copy["dir_prefix"]
        for path, fn in PAGES:
            out = f"{prefix}{path}index.html" if path.endswith("/") or path == "" else f"{prefix}{path}"
            write(out, fn(copy, prefix))
        write(f"{prefix}404.html" if prefix else "404.html", page_404(copy, prefix))

    urls = []
    for lang in BUILD_LANGS:
        prefix = load_copy(lang)["dir_prefix"]
        for path, _ in PAGES:
            urls.append(f"{BASE}/{prefix}{path}")
    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
               "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) +
               "</urlset>\n")
    write("sitemap.xml", sitemap)
    write("robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {BASE}/sitemap.xml\n")
    print("Done.")


if __name__ == "__main__":
    main()
