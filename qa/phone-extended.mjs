/* Extended phone checks beyond the main matrix:
     reduced-motion, no-JS fallback, 200%-text approximation, keyboard-only
     order, orientation round-trip, internal link crawl, LCP/CLS on a
     throttled connection, DPR image candidate choice, menu in mid landscape.
   Usage: QA_RIG=<dir-containing-node_modules> node qa/phone-extended.mjs */
import { pathToFileURL } from "node:url";
const RIG = process.env.QA_RIG;
const { webkit, chromium } = await import(RIG ? pathToFileURL(RIG + "/node_modules/playwright/index.mjs").href : "playwright");
const BASE = "http://localhost:4780";
let fail = 0;
const bad = (m) => { console.log("FAIL:", m); fail++; };
const ok = (m) => console.log("ok:", m);

const wk = await webkit.launch();
const iphone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, timezoneId: "Europe/Madrid" };

/* ---- 1. reduced motion: content visible, no reveal styles pending, no film ---- */
{
  const ctx = await wk.newContext({ ...iphone, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const mp4 = [];
  page.on("request", (r) => r.url().includes(".mp4") && mp4.push(r.url()));
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const r = await page.evaluate(() => {
    const h1 = document.querySelector("h1 .mask > span");
    const cs = getComputedStyle(h1);
    return { h1Shown: cs.transform === "none" || !cs.transform.includes("110"), op: getComputedStyle(document.querySelector("[data-reveal]")).opacity };
  });
  if (!r.h1Shown) bad("reduced-motion: h1 mask still offset");
  if (mp4.length) bad("reduced-motion: mp4 fetched " + mp4);
  ok("reduced motion: headline visible, no mp4");
  await ctx.close();
}

/* ---- 2. no-JS: readable, bookable, no sticky bar focus trap ---- */
{
  const ctx = await wk.newContext({ ...iphone, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const r = await page.evaluate(() => ({
    bookVisible: (() => { const b = document.querySelector(".hero__cta .btn--primary"); const x = b.getBoundingClientRect(); return x.height > 0; })(),
    accordionOpen: document.querySelector(".svc-row").getBoundingClientRect().height > 0,
    stickybarShown: getComputedStyle(document.querySelector(".stickybar")).display !== "none",
    heroH1: document.querySelector("h1").textContent.trim().length > 0,
    svcCount: document.querySelectorAll(".svc-row").length,
  }));
  if (!r.bookVisible) bad("no-js: booking CTA not rendered");
  if (!r.accordionOpen) bad("no-js: service rows collapsed");
  if (r.stickybarShown) bad("no-js: stickybar visible without its JS state manager");
  if (r.svcCount < 20) bad("no-js: service rows missing " + r.svcCount);
  ok("no-js: readable + bookable, accordions open, bar hidden (" + r.svcCount + " services)");
  await ctx.close();
}

/* ---- 3. 200% text approximation: doubled root font must not clip/overflow ---- */
{
  const ctx = await wk.newContext(iphone);
  for (const route of ["/", "/services/", "/find-us/", "/careers/"]) {
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
    await page.waitForTimeout(350);
    const r = await page.evaluate(() => ({
      // .break img carries a deliberate 1.06 reveal scale, clipped by
      // overflow:hidden — transforms don't create scrollable overflow
      sw: document.documentElement.scrollWidth, iw: window.innerWidth,
      priceClipped: [...document.querySelectorAll(".s-price, .t-price")].some((el) => el.scrollWidth > el.clientWidth + 2),
    }));
    if (r.sw > r.iw + 1) bad(`200% text ${route}: horizontal overflow ${r.sw}>${r.iw}`);
    if (r.priceClipped) bad(`200% text ${route}: price clipped`);
    await page.close();
  }
  ok("200% text-size approximation: no overflow, prices intact");
  await ctx.close();
}

/* ---- 4. keyboard-only: tab order reaches book fast; skip link first ----
   WebKit's plain Tab skips links (Safari default); Alt+Tab is Safari's
   full traversal, matching iOS "Full Keyboard Access". */
{
  const ctx = await wk.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, timezoneId: "Europe/Madrid" });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const seq = [];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Alt+Tab");
    seq.push(await page.evaluate(() => {
      const a = document.activeElement;
      return (a.className || a.tagName) + "|" + (a.textContent || "").trim().slice(0, 18);
    }));
  }
  if (!/skip/i.test(seq[0])) bad("keyboard: first tab is not the skip link: " + seq.join(" > "));
  const bookIdx = seq.findIndex((s) => /book/i.test(s));
  if (bookIdx === -1 || bookIdx > 3) bad("keyboard: BOOK not within first 4 tabs: " + seq.join(" > "));
  const focusRing = await page.evaluate(() => {
    const b = document.querySelector(".hdr__nav .btn--primary");
    b.focus();
    return getComputedStyle(b).boxShadow !== "none";
  });
  if (!focusRing) bad("keyboard: no visible focus ring on header BOOK");
  ok("keyboard(Alt+Tab): " + seq.slice(0, 4).join(" > "));
  await ctx.close();
}

/* ---- 5. orientation round-trip on find-us: no lost content/overflow ---- */
{
  const ctx = await wk.newContext(iphone);
  const page = await ctx.newPage();
  await page.goto(BASE + "/find-us/", { waitUntil: "networkidle" });
  const a = await page.evaluate(() => document.querySelectorAll(".hours tr").length);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(250);
  const l = await page.evaluate(() => ({ rows: document.querySelectorAll(".hours tr").length, sw: document.documentElement.scrollWidth, iw: innerWidth }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  const p = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth }));
  if (a !== 7 || l.rows !== 7) bad("orientation: hours rows lost");
  if (l.sw > l.iw + 1 || p.sw > p.iw + 1) bad("orientation: overflow after rotate");
  ok("orientation: hours intact both ways, no overflow");
  await ctx.close();
}

/* ---- 6. internal link crawl (from every route) ---- */
{
  const ctx = await wk.newContext(iphone);
  const page = await ctx.newPage();
  const seen = new Map();
  for (const route of ["/", "/services/", "/experience/", "/gallery/", "/about/", "/find-us/", "/careers/", "/legal/privacy/", "/legal/cookies/", "/404.html"]) {
    await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    const hrefs = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => h.startsWith("/") || h.startsWith("#")));
    for (const h of hrefs) if (!h.startsWith("#")) seen.set(h.split("#")[0], route);
  }
  let missing = 0;
  for (const [href] of seen) {
    const res = await page.request.get(BASE + href);
    if (res.status() >= 400) { bad(`link crawl: ${href} -> ${res.status()}`); missing++; }
  }
  if (!missing) ok(`link crawl: ${seen.size} unique internal links all resolve`);
  await ctx.close();
}

/* ---- 7. throttled 4G-ish load: LCP + CLS + transfer profile (chromium CDP) ---- */
{
  const cr = await chromium.launch();
  const ctx = await cr.newContext({ ...iphone, userAgent: undefined });
  const page = await ctx.newPage();
  const client = await ctx.newCDPSession(page);
  await client.send("Network.enable");
  await client.send("Network.emulateNetworkConditions", {
    offline: false, latency: 150, downloadThroughput: 1.6 * 1024 * 1024 / 8, uploadThroughput: 750 * 1024 / 8,
  });
  await client.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const t0 = Date.now();
  await page.goto(BASE + "/", { waitUntil: "load" });
  const metrics = await page.evaluate(() => new Promise((res) => {
    let lcp = 0, cls = 0;
    new PerformanceObserver((l) => { const e = l.getEntries(); lcp = e[e.length - 1].startTime; }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { l.getEntries().forEach((e) => { if (!e.hadRecentInput) cls += e.value; }); }).observe({ type: "layout-shift", buffered: true });
    setTimeout(() => {
      const lcpEl = performance.getEntriesByType("largest-contentful-paint").pop();
      res({ lcp: Math.round(lcp), cls: +cls.toFixed(4), lcpUrl: (lcpEl && lcpEl.url || "").split("/").pop(), loadT: Math.round(performance.timing.loadEventEnd - performance.timing.navigationStart) });
    }, 2500);
  }));
  console.log("throttled(4x CPU, 1.6Mbps):", JSON.stringify(metrics), "wall", Date.now() - t0 + "ms");
  if (metrics.lcp > 2500) bad("LCP over 2.5s on throttled run: " + metrics.lcp);
  if (metrics.cls > 0.1) bad("CLS over 0.1: " + metrics.cls);
  ok(`throttled LCP ${metrics.lcp}ms (${metrics.lcpUrl}), CLS ${metrics.cls}`);
  await cr.close();
}

/* ---- 8. DPR candidate choice for the hero ---- */
{
  for (const [w, h, dpr] of [[390, 844, 2], [390, 844, 3], [320, 568, 2]]) {
    const ctx = await wk.newContext({ ...iphone, viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    const reqs = [];
    page.on("request", (r) => /cave-hero-mobile-\d+/.test(r.url()) && reqs.push(r.url().match(/cave-hero-mobile-(\d+)/)[1]));
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    const need = w * dpr;
    const got = +reqs[0];
    const okCand = got >= Math.min(need, 1440) && (got <= need * 1.6 || got === 720);
    if (reqs.length !== 1 || !okCand) bad(`dpr ${w}@${dpr}: need ~${need}px got ${reqs.join(",")}`);
    else ok(`dpr ${w}@${dpr}: hero candidate ${got}w for ${need}px need`);
    await ctx.close();
  }
}

/* ---- 9. menu in mid landscape (667x375): close reachable, items scrollable ---- */
{
  const ctx = await wk.newContext({ ...iphone, viewport: { width: 667, height: 375 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const r = await page.evaluate(async () => {
    document.querySelector(".burger").click();
    await new Promise((r) => setTimeout(r, 400));
    const mm = document.getElementById("mmenu");
    const last = mm.querySelector(".mmenu__meta a:last-child");
    const canScrollToEnd = (() => { mm.scrollTop = mm.scrollHeight; return mm.scrollTop > 0 || mm.scrollHeight <= mm.clientHeight; })();
    const lastRect = last.getBoundingClientRect();
    const burgerVis = (() => { const b = document.querySelector(".burger").getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; })();
    return { canScrollToEnd, lastReachable: lastRect.top < innerHeight + mm.scrollHeight, burgerVis, menuH: mm.clientHeight, contentH: mm.scrollHeight };
  });
  if (!r.canScrollToEnd) bad("landscape 667 menu: cannot scroll to end");
  if (!r.burgerVis) bad("landscape 667 menu: close control off-screen");
  ok(`landscape 667 menu: scrolls (${r.contentH}>${r.menuH}), close visible`);
  await ctx.close();
}

await wk.close();
console.log(fail === 0 ? "\nALL EXTENDED CHECKS PASS" : `\n${fail} EXTENDED FAILURES`);
process.exit(fail ? 1 : 0);
