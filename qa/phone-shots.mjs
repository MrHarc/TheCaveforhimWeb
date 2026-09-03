/* Phone screenshot set (WebKit) for visual review.
   Usage: QA_RIG=<dir-containing-node_modules> node qa/phone-shots.mjs [outdir] */
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
const { webkit } = await import(process.env.QA_RIG
  ? pathToFileURL(process.env.QA_RIG + "/node_modules/playwright/index.mjs").href
  : "playwright");
const OUT = process.argv[2] || "qa/phone-shots";
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:4780";
const b = await webkit.launch();

const SETS = [
  [390, 844, 3, ["/", "/services/", "/experience/", "/gallery/", "/about/", "/find-us/", "/careers/", "/legal/privacy/", "/404.html"]],
  [320, 568, 2, ["/", "/services/", "/find-us/", "/careers/"]],
  [430, 932, 3, ["/"]],
  [932, 430, 3, ["/", "/services/"]],
  [568, 320, 2, ["/"]],
];
for (const [w, h, dpr, routes] of SETS) {
  const ctx = await b.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: dpr, isMobile: true, hasTouch: true, timezoneId: "Europe/Madrid",
  });
  for (const route of routes) {
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    await page.evaluate(async () => {
      await new Promise((res) => { const ok = () => [...document.querySelectorAll("link[rel=stylesheet]")].every((l) => l.media !== "print"); (function p() { ok() ? res() : setTimeout(p, 40); })(); });
      await document.fonts.ready;
      document.querySelectorAll("img[loading=lazy]").forEach((i) => (i.loading = "eager"));
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.7) { scrollTo({ top: y, behavior: "instant" }); await new Promise((r) => setTimeout(r, 60)); }
      scrollTo({ top: 0, behavior: "instant" });
      await Promise.all([...document.images].map((i) => i.decode().catch(() => {})));
      await new Promise((r) => setTimeout(r, 300));
    });
    const name = route === "/" ? "home" : route.replaceAll("/", "").replace(".html", "");
    await page.screenshot({ path: `${OUT}/${name}-${w}x${h}.png`, fullPage: true });
    await page.close();
  }
  // menu open state
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.evaluate(() => document.querySelector(".burger").click());
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/menu-${w}x${h}.png` });
  await page.close();
  await ctx.close();
  console.log(`${w}x${h} done`);
}
await b.close();
console.log("shots →", OUT);
