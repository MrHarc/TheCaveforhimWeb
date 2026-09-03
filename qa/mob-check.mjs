import puppeteer from "npm:puppeteer-core@23";
const b = await puppeteer.launch({executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--hide-scrollbars"]});
const p = await b.newPage();
await p.setViewport({width: 375, height: 667, isMobile: true, hasTouch: true});
await p.goto("http://localhost:4780/?m=" + Date.now(), {waitUntil: "networkidle0"});
await new Promise(r => setTimeout(r, 1500));
console.log(await p.evaluate(() => {
  const h = document.querySelector("[data-scrub-src]");
  return JSON.stringify({scrubOn: h.classList.contains("scrub-on"), video: !!h.querySelector("video"), ctaVisible: (r => r.top >= 0 && r.bottom <= innerHeight)(document.querySelector(".hero__cta").getBoundingClientRect()), hscroll: document.documentElement.scrollWidth <= innerWidth});
}));
await p.screenshot({path: "scrub-mobile.png"});
await b.close();
