// QA screenshot rig: deno run -A --node-modules-dir=auto shoot.mjs
// Full-page (correct vh handling) + per-section desktop captures via CDP.
import puppeteer from "npm:puppeteer-core@23";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:4780";

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

async function shootPage(url, name) {
  await page.goto(`${BASE}${url}${url.includes("?") ? "&" : "?"}noanim=1`, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: `${name}.png`, fullPage: true });
  console.log("full", name);
}

async function shootSections() {
  await page.goto(`${BASE}/?noanim=1`, { waitUntil: "networkidle0", timeout: 30000 });
  await new Promise(r => setTimeout(r, 400));
  const ids = ["services", "experience", "barbers", "work", "social", "find-us", "book"];
  for (const id of ids) {
    const el = await page.$(`#${id}`);
    if (!el) { console.log("missing", id); continue; }
    await page.evaluate((i) => document.getElementById(i).scrollIntoView({ behavior: "instant", block: "start" }), id);
    await new Promise(r => setTimeout(r, 350));
    await page.screenshot({ path: `sec-${id}.png` });
    console.log("sec", id);
  }
}

await shootPage("/", "home-desktop");
await shootSections();
await shootPage("/services/", "page-services");
await shootPage("/experience/", "page-experience");
await shootPage("/gallery/", "page-gallery");
await shootPage("/about/", "page-about");
await shootPage("/find-us/", "page-findus");
await shootPage("/careers/", "page-careers");
await shootPage("/legal/privacy/", "page-privacy");
await shootPage("/legal/cookies/", "page-cookies");
await shootPage("/404.html", "page-404");

// mobile pass
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await shootPage("/", "home-mobile");
await shootPage("/services/", "services-mobile");
await shootPage("/find-us/", "findus-mobile");

await browser.close();
console.log("ALL DONE");
