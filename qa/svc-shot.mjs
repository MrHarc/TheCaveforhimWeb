import puppeteer from "npm:puppeteer-core@23";
const b = await puppeteer.launch({executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--hide-scrollbars"]});
const p = await b.newPage();
await p.setViewport({width: 1440, height: 1000});
await p.goto("http://localhost:4780/services/?noanim=1&x=" + Date.now(), {waitUntil: "domcontentloaded", timeout: 60000});
await new Promise(r => setTimeout(r, 1500));
const dims = await p.evaluate(() => [...document.querySelectorAll(".menu-group__media img")].map(i => ({w: i.clientWidth, h: i.clientHeight})));
console.log(JSON.stringify(dims));
await b.close();
