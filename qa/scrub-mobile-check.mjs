/* Mobile scroll-scrub verification (Playwright WebKit, portrait iPhone).
   Asserts: portrait film fetched only AFTER load; scrub engages with the
   portrait runway; acts advance on the same beats; CTAs persist; the video
   seeks with scroll. Then the exclusions: landscape phone, reduced motion
   and Save-Data must not fetch any MP4.
   Usage: QA_RIG=<dir-containing-node_modules> node qa/scrub-mobile-check.mjs [outdir] */
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { webkit } = await import(process.env.QA_RIG
  ? pathToFileURL(process.env.QA_RIG + "/node_modules/playwright/index.mjs").href
  : "playwright");

const OUT = process.argv[2] || "qa/scrub-mobile";
mkdirSync(OUT, { recursive: true });
let ok = true;
const bad = (m) => { console.log("FAIL:", m); ok = false; };

const b = await webkit.launch();

/* ---- engaged path: 390x844 portrait ---- */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, timezoneId: "Europe/Madrid" });
  const page = await ctx.newPage();
  const vids = [];
  page.on("request", (r) => { if (r.url().includes(".mp4")) vids.push(r.url().split("/").pop()); });
  await page.goto("http://localhost:4780/", { waitUntil: "load" });
  await page.waitForSelector(".hero.scrub-on", { timeout: 15000 }).catch(() => bad("scrub-on never engaged on portrait phone"));
  await page.waitForTimeout(300);

  if (vids.length !== 1 || !vids[0].startsWith("cave-scroll-mobile.mp4")) bad("expected exactly cave-scroll-mobile.mp4, got: " + vids.join(","));
  // after-load proof from the page's own resource timing (event-order via
  // Playwright callbacks races against the in-page fetch listener)
  const timing = await page.evaluate(() => {
    const res = performance.getEntriesByType("resource").find((e) => e.name.includes("cave-scroll-mobile"));
    const nav = performance.getEntriesByType("navigation")[0];
    return res && nav ? { filmStart: Math.round(res.startTime), loadEventStart: Math.round(nav.loadEventStart) } : null;
  });
  if (!timing) bad("no resource timing for the film");
  else if (timing.filmStart < timing.loadEventStart) bad("film fetched before load: " + JSON.stringify(timing));
  else console.log("after-load ok:", JSON.stringify(timing));

  const state = await page.evaluate(() => {
    const h = document.querySelector(".hero");
    return {
      runway: h.style.getPropertyValue("--scrub-runway"),
      heightPx: h.offsetHeight,
      stagePos: getComputedStyle(h.querySelector(".hero__stage")).position,
      filmVideo: !!h.querySelector(".hero__film video"),
      videoW: h.querySelector(".hero__film video")?.videoWidth,
      videoH: h.querySelector(".hero__film video")?.videoHeight,
      videoReady: h.querySelector(".hero__film video")?.readyState,
      filmZ: getComputedStyle(h.querySelector(".hero__film")).zIndex,
      videoZ: getComputedStyle(h.querySelector(".hero__film video")).zIndex,
      primaryAnimation: getComputedStyle(h.querySelector(".hero__persist .btn--primary")).animationName,
      shineDisplay: getComputedStyle(h.querySelector(".hero__persist .btn--primary"), "::after").display,
      act3Size: parseFloat(getComputedStyle(h.querySelector(".hero__act--3 .hero__act-line")).fontSize),
      act3Clip: getComputedStyle(h.querySelector(".hero__act--3 .hero__act-line")).clipPath,
      act3Transition: getComputedStyle(h.querySelector(".hero__act--3 .hero__act-line")).transitionDuration,
      scheduler: h.getAttribute("data-scrub-scheduler"),
      frameMs: h.getAttribute("data-scrub-frame-ms"),
    };
  });
  if (state.runway !== "360vh") bad("mobile runway wrong: " + state.runway);
  if (state.stagePos !== "sticky") bad("stage not sticky: " + state.stagePos);
  if (!state.filmVideo) bad("no film video element");
  if (state.videoW !== 720 || state.videoH !== 1280) bad(`film not portrait 720x1280: ${state.videoW}x${state.videoH}`);
  if (state.videoReady < 2) bad("film enabled before a paintable frame was decoded");
  if (+state.filmZ < 0 || +state.videoZ < 0) bad(`film left on a negative Safari stacking layer: ${state.filmZ}/${state.videoZ}`);
  if (state.primaryAnimation !== "none" || state.shineDisplay !== "none") bad("phone CTA shine animation still active");
  if (state.act3Size < 64) bad("final headline is not large enough: " + state.act3Size + "px");
  if (state.act3Clip === "none" || !state.act3Transition.includes("0.56s")) bad("final headline reveal is missing");
  if (state.scheduler !== "frame-aware" || state.frameMs !== "42") bad("frame-aware phone scheduler is missing");
  console.log("engaged:", JSON.stringify(state));

  const acts = [];
  for (const p of [0.0, 0.2, 0.5, 0.8, 0.95]) {
    await page.evaluate(async (prog) => {
      const h = document.querySelector(".hero");
      const total = h.offsetHeight - innerHeight;
      scrollTo({ top: Math.round(prog * total), behavior: "instant" });
      await new Promise((r) => setTimeout(r, 700));
    }, p);
    const st = await page.evaluate(() => {
      const h = document.querySelector(".hero");
      const cta = document.querySelector(".hero__persist");
      const r = cta.getBoundingClientRect();
      // act TEXT must never overlap the booking actions (the act container
      // itself carries empty bottom slack, so measure its text children)
      let actOverlap = false;
      ["2", "3"].forEach((n) => {
        const el = h.querySelector(".hero__act--" + n);
        if (!el || getComputedStyle(el).opacity === "0") return;
        el.querySelectorAll(".hero__act-line, .label").forEach((txt) => {
          const a = txt.getBoundingClientRect();
          if (a.height && a.bottom > r.top && a.top < r.bottom) actOverlap = true;
        });
      });
      return {
        act: h.getAttribute("data-act"),
        ctaVisible: r.top >= 0 && r.bottom <= innerHeight && getComputedStyle(cta).opacity !== "0",
        actOverlap,
        t: +(h.querySelector(".hero__film video")?.currentTime ?? -1).toFixed(2),
      };
    });
    acts.push({ p, ...st });
    await page.screenshot({ path: `${OUT}/mobile-scrub-p${String(p).replace(".", "_")}.png` });
  }
  console.log(JSON.stringify(acts));
  for (const [p, want] of [[0, "1"], [0.2, "1"], [0.5, "2"], [0.8, "3"], [0.95, "4"]]) {
    const got = acts.find((a) => a.p === p);
    if (got.act !== want) bad(`act at p=${p}: want ${want} got ${got.act}`);
    if (!got.ctaVisible) bad(`CTA not visible at p=${p}`);
    if (got.actOverlap) bad(`act line overlaps CTA at p=${p}`);
  }
  if (!(acts[4].t > acts[0].t + 3)) bad("video not seeking with scroll");

  /* A touch flick can deliver many scroll positions before Safari decodes one
     frame. The scheduler must discard obsolete positions and catch the newest
     request instead of queuing every intermediate seek. */
  const burst = await page.evaluate(async () => {
    const h = document.querySelector(".hero");
    const total = h.offsetHeight - innerHeight;
    for (const p of [0.12, 0.34, 0.66, 0.28, 0.74]) {
      scrollTo({ top: Math.round(p * total), behavior: "instant" });
      await new Promise((r) => requestAnimationFrame(r));
    }
    await new Promise((r) => setTimeout(r, 1200));
    const v = h.querySelector(".hero__film video");
    return { currentTime: v.currentTime, wanted: 0.74 * (v.duration - (1 / 24)), seeking: v.seeking };
  });
  if (burst.seeking || Math.abs(burst.currentTime - burst.wanted) > 0.12) bad("phone seek queue did not catch the newest flick target: " + JSON.stringify(burst));
  console.log("flick coalescing:", JSON.stringify(burst));
  const finalFrame = await page.evaluate(async () => {
    const h = document.querySelector(".hero");
    const total = h.offsetHeight - innerHeight;
    scrollTo({ top: total, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 1200));
    const v = h.querySelector(".hero__film video");
    return { currentTime: v.currentTime, duration: v.duration, ended: v.ended };
  });
  if (finalFrame.ended || finalFrame.currentTime >= finalFrame.duration) bad("phone scrub sought into WebKit's ended state");
  console.log("clean final hold:", JSON.stringify(finalFrame));
  await page.screenshot({ path: `${OUT}/mobile-scrub-final.png` });

  /* Safari browser chrome contracts the visible page substantially. Re-test
     the live scrub after viewport changes instead of assuming 390x844. */
  const chromeStates = [];
  for (const [w, h, p] of [[390, 720, 0.5], [390, 650, 0.8], [320, 568, 0.5]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(async (prog) => {
      const hero = document.querySelector(".hero");
      const total = hero.offsetHeight - innerHeight;
      scrollTo({ top: Math.round(prog * total), behavior: "instant" });
      await new Promise((r) => setTimeout(r, 900));
    }, p);
    const live = await page.evaluate(() => {
      const hero = document.querySelector(".hero");
      const header = document.querySelector(".hdr").getBoundingClientRect();
      const cta = hero.querySelector(".hero__persist").getBoundingClientRect();
      const active = hero.querySelector(`[class~="hero__act--${hero.getAttribute("data-act")}"]`);
      const text = active ? [...active.querySelectorAll(".hero__act-line, .label")].map((el) => el.getBoundingClientRect()) : [];
      return {
        viewport: `${innerWidth}x${innerHeight}`,
        stageH: Math.round(hero.querySelector(".hero__stage").getBoundingClientRect().height),
        ctaVisible: cta.top >= header.bottom && cta.bottom <= innerHeight,
        headerOverlap: text.some((r) => r.height && r.top < header.bottom),
        ctaOverlap: text.some((r) => r.height && r.bottom > cta.top),
      };
    });
    chromeStates.push(live);
    if (Math.abs(live.stageH - h) > 2) bad(`dynamic stage height wrong at ${live.viewport}: ${live.stageH}`);
    if (!live.ctaVisible) bad(`CTA outside contracted viewport at ${live.viewport}`);
    if (live.headerOverlap || live.ctaOverlap) bad(`copy collision at ${live.viewport}: ${JSON.stringify(live)}`);
  }
  console.log("chrome states:", JSON.stringify(chromeStates));

  const suspended = await page.evaluate(async () => {
    const hero = document.querySelector(".hero");
    scrollTo({ top: hero.offsetTop + hero.offsetHeight + innerHeight, behavior: "instant" });
    await new Promise((r) => setTimeout(r, 400));
    return hero.getAttribute("data-scrub-active");
  });
  if (suspended !== "0") bad("offscreen phone scrub did not suspend");
  else console.log("offscreen suspension ok");
  await ctx.close();
}

/* ---- exclusions: no MP4 may load ---- */
async function assertNoFilm(label, ctxOpts, extra) {
  const ctx = await b.newContext(ctxOpts);
  const page = await ctx.newPage();
  if (extra) await extra(page);
  const vids = [];
  page.on("request", (r) => { if (r.url().includes(".mp4")) vids.push(r.url()); });
  await page.goto("http://localhost:4780/", { waitUntil: "load" });
  await page.waitForTimeout(1800);
  if (vids.length) bad(`${label}: fetched ${vids.join(",")}`);
  else console.log("excluded ok:", label);
  await ctx.close();
}
await assertNoFilm("landscape phone 844x390", { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await assertNoFilm("landscape phone 932x430", { viewport: { width: 932, height: 430 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await assertNoFilm("reduced motion portrait", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
await assertNoFilm("no-JS portrait", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, javaScriptEnabled: false });

await b.close();
console.log(ok ? "MOBILE SCRUB OK" : "MOBILE SCRUB BROKEN");
process.exit(ok ? 0 : 1);
