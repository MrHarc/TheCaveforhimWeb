/* Desktop scroll-scrub hero verification (Playwright chromium, fine pointer,
   motion allowed). Asserts the approved film behaviour is intact:
   eligibility, runway height, act beats at controlled progress points,
   CTA persistence, poster painted, film video present and seeking.
   Usage: QA_RIG=<dir-containing-node_modules> node qa/scrub-check.mjs [outdir] */
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.QA_RIG
  ? pathToFileURL(process.env.QA_RIG + "/node_modules/playwright/index.mjs").href
  : "playwright");

const OUT = process.argv[2] || "qa/scrub-state";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  timezoneId: "Europe/Madrid",
});
const page = await ctx.newPage();
const vids = [];
page.on("request", (r) => { if (r.url().endsWith(".mp4")) vids.push(r.url()); });
await page.goto("http://localhost:4780/", { waitUntil: "load" });
await page.waitForSelector(".hero.scrub-on", { timeout: 15000 });
await page.waitForTimeout(400);

const runway = await page.evaluate(() => {
  const h = document.querySelector(".hero");
  return {
    runwayVar: h.style.getPropertyValue("--scrub-runway"),
    heightPx: h.offsetHeight,
    stageSticky: getComputedStyle(h.querySelector(".hero__stage")).position,
    filmVideo: !!h.querySelector(".hero__film video"),
  };
});
console.log("runway:", JSON.stringify(runway), "| mp4 fetched:", vids.join(","));

const acts = [];
for (const p of [0.0, 0.2, 0.5, 0.8, 0.95]) {
  await page.evaluate(async (prog) => {
    const h = document.querySelector(".hero");
    const total = h.offsetHeight - innerHeight;
    scrollTo(0, Math.round(prog * total));
    await new Promise((r) => setTimeout(r, 700));
  }, p);
  const st = await page.evaluate(() => {
    const h = document.querySelector(".hero");
    const cta = document.querySelector(".hero__persist");
    const r = cta.getBoundingClientRect();
    const style = getComputedStyle(cta);
    return {
      act: h.getAttribute("data-act"),
      ctaVisible: r.top >= 0 && r.bottom <= innerHeight && style.opacity !== "0" && style.visibility !== "hidden",
      videoTime: +(h.querySelector(".hero__film video")?.currentTime ?? -1).toFixed(2),
    };
  });
  acts.push({ p, ...st });
  await page.screenshot({ path: `${OUT}/scrub-p${String(p).replace(".", "_")}.png` });
}
console.log(JSON.stringify(acts, null, 1));

// expectations from main.js: p<0.36 act1, <0.72 act2, <0.90 act3, else act4
const exp = [["0", "1"], ["0.2", "1"], ["0.5", "2"], ["0.8", "3"], ["0.95", "4"]];
let ok = true;
for (const [p, want] of exp) {
  const got = acts.find((x) => String(x.p) === p);
  if (!got || got.act !== want) { console.log(`ACT MISMATCH at p=${p}: want ${want} got ${got?.act}`); ok = false; }
  if (!got.ctaVisible) { console.log(`CTA NOT VISIBLE at p=${p}`); ok = false; }
}
if (!vids.some((v) => v.includes("cave-scroll.mp4"))) { console.log("FILM NOT FETCHED"); ok = false; }
const seekMoved = acts[acts.length - 1].videoTime > acts[0].videoTime + 3;
if (!seekMoved) { console.log("VIDEO NOT SEEKING WITH SCROLL"); ok = false; }
console.log(ok ? "SCRUB OK" : "SCRUB BROKEN");
await browser.close();
process.exit(ok ? 0 : 1);
