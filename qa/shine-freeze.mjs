import puppeteer from "npm:puppeteer-core@23";
const b = await puppeteer.launch({executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--hide-scrollbars"]});
const p = await b.newPage();
await p.setViewport({width: 1440, height: 900});
await p.goto("http://localhost:4780/?f=" + Date.now(), {waitUntil: "domcontentloaded", timeout: 60000});
await new Promise(r => setTimeout(r, 2200));
await p.evaluate(() => {
  const s = document.createElement("style");
  s.textContent = ".btn--primary::after{animation:none !important; left:32% !important}";
  document.head.appendChild(s);
});
await new Promise(r => setTimeout(r, 300));
const el = await p.$(".hero__persist");
await el.screenshot({path: "shine-frozen.png"});
await b.close(); console.log("ok");
