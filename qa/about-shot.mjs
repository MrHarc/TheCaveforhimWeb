import puppeteer from "npm:puppeteer-core@23";
const b = await puppeteer.launch({executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--hide-scrollbars"]});
const p = await b.newPage();
await p.setViewport({width: 1440, height: 1100});
await p.goto("http://localhost:4780/about/?noanim=1&a=" + Date.now(), {waitUntil: "domcontentloaded", timeout: 60000});
await new Promise(r => setTimeout(r, 1500));
await p.screenshot({path: "page-about-fixed.png", fullPage: false});
await b.close(); console.log("ok");
