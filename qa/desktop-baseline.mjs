/* Desktop regression rig (Playwright, node).
   Captures deterministic full-page shots of every route at the locked desktop
   sizes. Run once before phone work (baseline) and again after (final), then
   compare with desktop-diff.mjs. Desktop rendering is LOCKED — target: zero diff.

   Usage:
     QA_RIG=<dir-containing-node_modules-with-playwright> node qa/desktop-baseline.mjs <outdir>

   Determinism: fixed clock (open/closed status + year stamp), ?noanim=1,
   prefers-reduced-motion, DPR 1, fonts awaited, lazy images forced eager,
   scrollbars hidden by Playwright's fullPage capture. */
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { chromium } = await import(process.env.QA_RIG
  ? pathToFileURL(process.env.QA_RIG + "/node_modules/playwright/index.mjs").href
  : "playwright");

const OUT = process.argv[2] || "qa/desktop-baseline";
const BASE = "http://localhost:4780";
const ROUTES = [
  ["home", "/"],
  ["services", "/services/"],
  ["experience", "/experience/"],
  ["gallery", "/gallery/"],
  ["about", "/about/"],
  ["findus", "/find-us/"],
  ["careers", "/careers/"],
  ["privacy", "/legal/privacy/"],
  ["cookies", "/legal/cookies/"],
  ["404", "/404.html"],
];
const SIZES = [
  [900, 700],
  [1024, 768],
  [1280, 720],
  [1440, 900],
  [1728, 1117],
];
// Fixed Wednesday 12:00 Madrid summer time — status renders "Open today until 18:30".
const FIXED_TIME = new Date("2026-08-13T10:00:00.000Z");

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
for (const [w, h] of SIZES) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    timezoneId: "Europe/Madrid",
    locale: "en-GB",
  });
  for (const [name, route] of ROUTES) {
    const page = await ctx.newPage();
    await page.clock.install({ time: FIXED_TIME });
    const sep = route.includes("?") ? "&" : "?";
    await page.goto(BASE + route + sep + "noanim=1", { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      // deferred stylesheet loads with media=print then swaps — wait for the swap
      await new Promise((res) => {
        const ok = () => [...document.querySelectorAll("link[rel=stylesheet]")]
          .every((l) => l.media !== "print");
        (function poll() { ok() ? res() : setTimeout(poll, 40); })();
      });
      document.querySelectorAll("img[loading=lazy]").forEach((i) => (i.loading = "eager"));
      await document.fonts.ready;
      await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
      // wait for layout to settle (two consecutive frames with equal scrollHeight)
      let last = -1;
      for (let k = 0; k < 50; k++) {
        const cur = document.documentElement.scrollHeight;
        if (cur === last) break;
        last = cur;
        await new Promise((r) => setTimeout(r, 60));
      }
    });
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${OUT}/${name}-${w}x${h}.png`, fullPage: true, animations: "disabled" });
    await page.close();
    process.stdout.write(`  ${name}-${w}x${h}\n`);
  }
  await ctx.close();
}
await browser.close();
console.log("done →", OUT);
