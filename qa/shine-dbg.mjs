import puppeteer from "npm:puppeteer-core@23";
const b = await puppeteer.launch({executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--hide-scrollbars"]});
const p = await b.newPage();
await p.setViewport({width: 1440, height: 900});
await p.goto("http://localhost:4780/?d=" + Date.now(), {waitUntil: "domcontentloaded", timeout: 60000});
await new Promise(r => setTimeout(r, 2200));
console.log(await p.evaluate(() => {
  const btn = document.querySelector(".hero__persist .btn--primary");
  const cs = getComputedStyle(btn, "::after");
  return JSON.stringify({anim: cs.animationName, dur: cs.animationDuration, left: cs.left, width: cs.width, content: cs.content, pos: getComputedStyle(btn).position, bg: cs.backgroundImage.slice(0, 60)});
}));
await b.close();
