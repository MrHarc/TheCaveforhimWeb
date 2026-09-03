/* Phone audit rig — measures the mobile experience across the full iPhone
   viewport matrix on WebKit (Safari's engine) and Chromium.
   Read-only: makes no bookings, sends nothing, fills forms only in-memory.

   Usage: QA_RIG=<dir-containing-node_modules> node qa/phone-audit.mjs [--engine=webkit|chromium] [--json=out.json]

   Checks (per route × viewport):
     overflow        no horizontal scroll; names offenders
     mp4             no video request on any phone viewport
     console         no console errors / failed local requests
     lcp             exactly one cave-hero-mobile fetch on /, not lazy
     targets         44×44 hit areas on important controls
     fontmin         inputs ≥16px; body copy ≥16px
     clip            no clipped headings/prices/captions
     ctafold         booking CTA visible at 375×667 without scroll
     stickybar       visual/ARIA/tab-order sync
     menu            lock, scroll restore, focus trap, Escape, landscape fit
     accordion       aria-expanded + panel state
     reveal          no [data-reveal] stuck invisible after full scroll
     anchors         fixed-header clearance for #targets
     form            careers validation + value retention (no submit)
*/
import { pathToFileURL } from "node:url";
import { writeFileSync } from "node:fs";
const RIG = process.env.QA_RIG;
const pw = await import(RIG ? pathToFileURL(RIG + "/node_modules/playwright/index.mjs").href : "playwright");

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
const ENGINE = args.engine || "webkit";
const BASE = "http://localhost:4780";

const PORTRAIT = [[320, 568, 2], [375, 667, 2], [390, 844, 3], [393, 852, 3], [430, 932, 3]];
const LANDSCAPE = [[568, 320, 2], [667, 375, 2], [844, 390, 3], [852, 393, 3], [932, 430, 3]];
const ROUTES = ["/", "/services/", "/experience/", "/gallery/", "/about/", "/find-us/", "/careers/", "/legal/privacy/", "/legal/cookies/", "/404.html"];

// important interactive controls that must give 44×44 (or ≥44 in one axis with
// enough padding); inline prose links are audited separately at 24px minimum.
const TARGET_SEL = [
  ".hdr__logo", ".hdr__nav .btn", ".burger",
  ".stickybar .btn", ".hero__cta .btn", ".final__cta .btn", ".hero__meta a",
  ".svc-group__head", ".svc-row", ".book-with", ".tile",
  ".find__contact a", ".find .btn", ".work__cta .mono-link",
  ".ftr a", ".ftr__social a", "#careers-form .btn", ".mmenu a", ".mmenu .btn",
  ".social__cta .btn", ".page-head a", ".about-body .btn", ".nf .btn", ".mono-link",
].join(", ");

const IA = { violations: [], notes: [] };
function viol(vp, route, kind, detail) { IA.violations.push({ vp, route, kind, detail }); }

const browser = await pw[ENGINE].launch();

async function makeCtx(w, h, dpr) {
  return browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: dpr,
    isMobile: true,
    hasTouch: true,
    timezoneId: "Europe/Madrid",
    userAgent: ENGINE === "webkit"
      ? "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1"
      : undefined,
  });
}

async function settle(page) {
  await page.evaluate(async () => {
    await new Promise((res) => {
      const ok = () => [...document.querySelectorAll("link[rel=stylesheet]")].every((l) => l.media !== "print");
      (function poll() { ok() ? res() : setTimeout(poll, 40); })();
    });
    await document.fonts.ready;
  });
}

for (const [w, h, dpr] of [...PORTRAIT, ...LANDSCAPE]) {
  const vp = `${w}x${h}@${dpr}x`;
  const ctx = await makeCtx(w, h, dpr);
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const mp4s = [], errors = [], failed = [], heroReqs = [];
    page.on("request", (r) => {
      if (r.url().includes(".mp4")) mp4s.push(r.url());
      if (/cave-hero-mobile-\d+|cave-hero-\d+|scrub-poster/.test(r.url())) heroReqs.push(r.url().split("/").pop());
    });
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("requestfailed", (r) => { if (r.url().startsWith(BASE)) failed.push(r.url() + " " + (r.failure()?.errorText || "")); });
    page.on("response", (r) => { if (r.url().startsWith(BASE) && r.status() >= 400) failed.push(r.url() + " " + r.status()); });
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await settle(page);

    // overflow
    const ov = await page.evaluate(() => {
      const iw = window.innerWidth;
      const sw = document.documentElement.scrollWidth;
      if (sw <= iw + 1) return null;
      const bad = [];
      document.querySelectorAll("body *").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width && (r.right > iw + 1 || r.left < -1) && !el.closest(".strip") && !el.matches(".strip")) {
          const cls = (typeof el.className === "string" && el.className) ? "." + el.className.split(" ")[0] : "";
          bad.push(`${el.tagName}${cls} L${Math.round(r.left)} R${Math.round(r.right)}`);
        }
      });
      return { sw, iw, bad: bad.slice(0, 6) };
    });
    if (ov) viol(vp, route, "overflow", ov);

    // portrait phones may fetch exactly the 9:16 scrub film on the homepage
    // (after load); landscape phones and every other route fetch no video.
    const allowedMp4 = route === "/" && h > w && w <= 899 ? "cave-scroll-mobile.mp4" : null;
    const badMp4 = mp4s.filter((u) => !allowedMp4 || !new URL(u).pathname.endsWith(allowedMp4));
    if (badMp4.length || mp4s.length > 1) viol(vp, route, "mp4", mp4s);
    if (errors.length) viol(vp, route, "console", errors.slice(0, 3));
    if (failed.length) viol(vp, route, "requestfail", [...new Set(failed)].slice(0, 3));

    if (route === "/") {
      // <=899px phones use the portrait mobile hero; a 900-950px landscape
      // phone correctly gets the approved 16:9 crop (its preload window matches).
      // Either way: exactly one hero request, no scrub poster, no duplicates.
      const mob = heroReqs.filter((u) => u.startsWith("cave-hero-mobile-"));
      const desk = heroReqs.filter((u) => /^cave-hero-\d+/.test(u));
      const poster = heroReqs.filter((u) => u.startsWith("scrub-poster"));
      const wantMobile = w <= 899;
      if (wantMobile && (mob.length !== 1 || desk.length))
        viol(vp, route, "lcp-count", heroReqs);
      if (!wantMobile && (desk.length !== 1 || mob.length))
        viol(vp, route, "lcp-count", heroReqs);
      if (poster.length) viol(vp, route, "lcp-scrub-poster-on-phone", poster);
      const lazy = await page.evaluate(() => document.querySelector(".hero__media img")?.loading);
      if (lazy === "lazy") viol(vp, route, "lcp-lazy", lazy);
    }

    // touch targets (skip elements hidden at this vp)
    const targets = await page.evaluate((sel) => {
      const out = [];
      document.querySelectorAll(sel).forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        if (el.closest(".mmenu") && !el.closest(".mmenu.open")) return; // menu audited separately
        if (el.closest(".stickybar") && !el.closest(".stickybar.on")) return;
        if (r.height < 43.5 || r.width < 43.5) {
          const cls = (typeof el.className === "string" && el.className) ? "." + el.className.split(" ")[0] : el.tagName;
          out.push(`${cls} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || "").trim().slice(0, 24)}"`);
        }
      });
      return out;
    }, TARGET_SEL);
    if (targets.length) viol(vp, route, "target", [...new Set(targets)].slice(0, 12));

    // font sizes
    const fonts = await page.evaluate(() => {
      const small = [];
      document.querySelectorAll("input, textarea").forEach((el) => {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 16) small.push(`form ${el.id || el.name} ${fs}px`);
      });
      document.querySelectorAll("main p:not(.caption):not(.hero__micro), main address, main li").forEach((el) => {
        if (el.closest(".num, .label")) return;
        const cs = getComputedStyle(el);
        if (cs.display === "none") return;
        const fs = parseFloat(cs.fontSize);
        if (fs < 15.5 && el.textContent.trim().length > 40) small.push(`body ${el.className || el.tagName} ${fs}px`);
      });
      return small;
    });
    if (fonts.length) viol(vp, route, "fontmin", [...new Set(fonts)].slice(0, 8));

    // clipped text: a text run wider than its container's padding box.
    // (scrollWidth alone lies in WebKit for flex-squeezed nowrap buttons —
    // it reports pre-shrink metrics even when the text fits exactly.)
    const clip = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll("h1, h2, h3, .s-price, .s-name, .t-price, .btn, .menu-table caption, address, .hero__lead").forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === "none") return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return; // inside a hidden ancestor
        const range = document.createRange();
        range.selectNodeContents(el);
        const tw = range.getBoundingClientRect().width;
        const avail = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        if (tw > avail + 2 && cs.overflowX !== "visible" || (tw > avail + 2 && el.matches(".btn"))) {
          out.push(`${el.tagName}.${(typeof el.className === "string" ? el.className.split(" ")[0] : "")} text${Math.round(tw)}>avail${Math.round(avail)} "${el.textContent.trim().slice(0, 30)}"`);
        }
      });
      return out;
    });
    if (clip.length) viol(vp, route, "clip", clip.slice(0, 6));

    // anchor clearance under fixed header
    if (route === "/") {
      const anchors = await page.evaluate(() => {
        const out = [];
        ["services", "experience", "work", "find-us", "book", "barbers", "social", "main"].forEach((id) => {
          const el = document.getElementById(id);
          if (!el) return;
          const sm = parseFloat(getComputedStyle(el).scrollMarginTop || "0");
          out.push(`${id}:${sm}`);
        });
        return out;
      });
      const noMargin = anchors.filter((a) => a.endsWith(":0"));
      if (noMargin.length) viol(vp, route, "anchor-margin", noMargin);
    }

    await page.close();
  }
  await ctx.close();
  process.stdout.write(`matrix ${vp} done\n`);
}

/* ---------------- interaction tests on key viewports ---------------- */
const KEY = [[390, 844, 3], [320, 568, 2], [932, 430, 3], [568, 320, 2]];
for (const [w, h, dpr] of KEY) {
  const vp = `${w}x${h}@${dpr}x`;
  const ctx = await makeCtx(w, h, dpr);
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await settle(page);

  // burger visible at this vp?
  const burgerVisible = await page.evaluate(() => {
    const b = document.querySelector(".burger");
    return b && getComputedStyle(b).display !== "none";
  });
  if (!burgerVisible) {
    viol(vp, "/", "menu-no-burger", "burger hidden — desktop header on a phone viewport");
  } else {
    // menu behaviour
    const menu = await page.evaluate(async () => {
      const out = {};
      scrollTo({ top: 500, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 120));
      out.preScroll = scrollY;
      document.querySelector(".burger").click();
      await new Promise((r) => setTimeout(r, 350));
      const mm = document.getElementById("mmenu");
      out.open = mm.classList.contains("open");
      out.ariaExpanded = document.querySelector(".burger").getAttribute("aria-expanded");
      out.menuScrollable = mm.scrollHeight > mm.clientHeight ? "yes" : "fits";
      const mmRect = mm.getBoundingClientRect();
      out.menuCoversViewport = mmRect.top <= 0 && mmRect.bottom >= innerHeight - 1;
      const burger = document.querySelector(".burger");
      const br = burger.getBoundingClientRect();
      out.closeVisible = br.top >= 0 && br.bottom <= innerHeight && getComputedStyle(burger).display !== "none";
      // background lock: try scrolling the window
      const y0 = scrollY;
      scrollTo({ top: y0 + 300, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 120));
      out.bgMoved = Math.abs(scrollY - y0) > 1 && document.body.classList.contains("menu-locked") ? scrollY - y0 : 0;
      out.lockClass = document.body.classList.contains("menu-locked");
      // focus containment: is active element inside menu after open?
      out.focusInMenu = mm.contains(document.activeElement);
      return out;
    });
    // Escape close + focus restore + scroll restore (via keyboard for realism)
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const post = await page.evaluate(() => ({
      open: document.getElementById("mmenu").classList.contains("open"),
      scrollY: scrollY,
      focusOnBurger: document.activeElement === document.querySelector(".burger"),
      locked: document.body.classList.contains("menu-locked"),
    }));
    if (!menu.open) viol(vp, "/", "menu-open-fail", menu);
    if (!menu.menuCoversViewport) viol(vp, "/", "menu-not-fullscreen", menu);
    if (!menu.closeVisible) viol(vp, "/", "menu-close-hidden", menu);
    if (menu.bgMoved) viol(vp, "/", "menu-bg-scrolls", menu.bgMoved);
    if (!menu.focusInMenu) viol(vp, "/", "menu-focus-not-moved", menu);
    if (post.open) viol(vp, "/", "menu-escape-fail", post);
    if (post.scrollY !== menu.preScroll) viol(vp, "/", "menu-scroll-restore", `expected ${menu.preScroll} got ${post.scrollY}`);
    if (!post.focusOnBurger) viol(vp, "/", "menu-focus-restore", post);
    if (post.locked) viol(vp, "/", "menu-lock-stuck", post);
  }

  // sticky bar sync
  const bar = await page.evaluate(async () => {
    const out = {};
    const bar = document.querySelector(".stickybar");
    if (!bar) return { missing: true };
    scrollTo({ top: 0, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 250));
    const cs = getComputedStyle(bar);
    out.display = cs.display;
    if (cs.display === "none") return out; // desktop-rule viewport
    out.offscreenAtTop = bar.getBoundingClientRect().top >= innerHeight - 1 || !bar.classList.contains("on");
    out.ariaHiddenAtTop = bar.getAttribute("aria-hidden");
    out.focusableWhileHidden = (() => {
      const a = bar.querySelector("a");
      a.focus();
      return document.activeElement === a && !bar.classList.contains("on");
    })();
    document.activeElement.blur();
    scrollTo({ top: document.body.scrollHeight / 2, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 250));
    scrollTo({ top: scrollY - 60, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 350));
    out.onAfterScrollUp = bar.classList.contains("on");
    out.ariaWhenOn = bar.getAttribute("aria-hidden");
    return out;
  });
  if (!bar.missing && bar.display !== "none") {
    if (bar.offscreenAtTop && bar.ariaHiddenAtTop === "false" && bar.focusableWhileHidden)
      viol(vp, "/", "stickybar-hidden-focusable", bar);
    if (!bar.onAfterScrollUp) IA.notes.push(`${vp} stickybar did not show on scroll-up (check trigger)`);
  } else if (bar.display === "none" && w >= 900) {
    viol(vp, "/", "stickybar-none-on-landscape-phone", "coarse-pointer 932px phone gets desktop rules");
  }

  // accordion
  const acc = await page.evaluate(async () => {
    const heads = [...document.querySelectorAll(".svc-group__head")];
    if (!heads.length) return null;
    const h2 = heads[1];
    const g = h2.closest(".svc-group");
    const before = h2.getAttribute("aria-expanded");
    h2.click();
    await new Promise((r) => setTimeout(r, 400));
    const after = h2.getAttribute("aria-expanded");
    const rowVisible = (() => {
      const row = g.querySelector(".svc-row");
      const r = row.getBoundingClientRect();
      return r.height > 0;
    })();
    return { before, after, rowVisible };
  });
  if (acc && (acc.before !== "false" || acc.after !== "true" || !acc.rowVisible))
    viol(vp, "/", "accordion", acc);

  // reveal completeness: scroll to bottom, everything revealed?
  // instant steps: the page's own smooth scroll-behavior would otherwise turn
  // each step into a restarted animation that flies past mid-page sections
  const unrevealed = await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.7) {
      scrollTo({ top: y, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 90));
    }
    scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 400));
    return [...document.querySelectorAll("[data-reveal]:not(.in)")].map((el) => el.className).slice(0, 5);
  });
  if (unrevealed.length) viol(vp, "/", "reveal-stuck", unrevealed);

  // CTA fold check (portrait only)
  if (h > w) {
    const cta = await page.evaluate(async () => {
      scrollTo({ top: 0, behavior: "instant" });
      await new Promise((r) => setTimeout(r, 150));
      const btn = document.querySelector(".hero__cta .btn--primary");
      const r = btn.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight };
    });
    if (w >= 375 && cta.bottom > cta.vh) viol(vp, "/", "cta-below-fold", cta);
    if (w === 320 && cta.bottom > cta.vh * 1.6) viol(vp, "/", "cta-too-deep-320", cta);
  }
  await page.close();

  // careers form
  const fpage = await ctx.newPage();
  await fpage.goto(BASE + "/careers/", { waitUntil: "networkidle" });
  await settle(fpage);
  const form = await fpage.evaluate(async () => {
    const out = {};
    const f = document.getElementById("careers-form");
    const name = f.elements.name, msg = f.elements.message;
    // empty submit
    f.querySelector("button[type=submit]").click();
    await new Promise((r) => setTimeout(r, 150));
    out.statusText = document.getElementById("form-status").textContent.trim().slice(0, 40);
    out.ariaInvalidName = name.getAttribute("aria-invalid");
    out.focusMovedToInvalid = document.activeElement === name;
    // value retention across viewport change is tested outside
    name.value = "QA Probe";
    msg.value = "Testing only — not sent.";
    return out;
  });
  await fpage.setViewportSize({ width: h, height: w }); // rotate
  await fpage.waitForTimeout(250);
  const retained = await fpage.evaluate(() => document.getElementById("careers-form").elements.name.value);
  if (retained !== "QA Probe") viol(vp, "/careers/", "form-value-lost-rotation", retained);
  if (!form.statusText) viol(vp, "/careers/", "form-no-error-message", form);
  if (form.ariaInvalidName !== "true") viol(vp, "/careers/", "form-no-aria-invalid", form);
  if (!form.focusMovedToInvalid) viol(vp, "/careers/", "form-no-focus-to-invalid", form);
  await fpage.close();
  await ctx.close();
  process.stdout.write(`interactions ${vp} done\n`);
}

await browser.close();

console.log("\n==== VIOLATIONS ====", IA.violations.length);
const byKind = {};
for (const v of IA.violations) (byKind[v.kind] ||= []).push(v);
for (const [k, list] of Object.entries(byKind)) {
  console.log(`\n-- ${k} (${list.length})`);
  for (const v of list.slice(0, 14)) console.log(`  ${v.vp} ${v.route}`, JSON.stringify(v.detail).slice(0, 240));
  if (list.length > 14) console.log(`  ...and ${list.length - 14} more`);
}
if (IA.notes.length) console.log("\nnotes:", IA.notes.join("; "));
if (args.json) writeFileSync(args.json, JSON.stringify(IA, null, 1));
console.log("\nengine:", ENGINE, pw[ENGINE].name?.() ?? "");
