import puppeteer from "npm:puppeteer-core@23";
const b = await puppeteer.launch({executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--hide-scrollbars"]});
const p = await b.newPage();
await p.setViewport({width: 1440, height: 900});
p.goto("http://localhost:4780/?i=" + Date.now(), {waitUntil: "domcontentloaded", timeout: 60000});
await new Promise(r => setTimeout(r, 450));
await p.screenshot({path: "intro-mid.png"});
await new Promise(r => setTimeout(r, 1300));
await p.screenshot({path: "intro-after.png"});
const gone = await p.evaluate(() => !document.getElementById("intro"));
// second visit in same session: veil must not appear
await p.goto("http://localhost:4780/?i2=" + Date.now(), {waitUntil: "domcontentloaded"});
await new Promise(r => setTimeout(r, 300));
const secondVisit = await p.evaluate(() => { const el = document.getElementById("intro"); return el ? el.className : "removed"; });
console.log(JSON.stringify({veilRemovedAfter: gone, secondVisit}));
await b.close();
