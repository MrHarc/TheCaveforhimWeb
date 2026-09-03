import puppeteer from "npm:puppeteer-core@23";
const b = await puppeteer.launch({executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--hide-scrollbars"]});
const p = await b.newPage();
await p.setViewport({width: 375, height: 667, isMobile: true, hasTouch: true});
await p.goto("http://localhost:4780/?m=" + Date.now(), {waitUntil: "domcontentloaded", timeout: 60000});
await new Promise(r => setTimeout(r, 1500));
await p.screenshot({path: "hdr-mobile.png", clip: {x: 0, y: 0, width: 375, height: 300}});
await b.close(); console.log("ok");
