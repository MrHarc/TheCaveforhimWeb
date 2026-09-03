import puppeteer from "npm:puppeteer-core@23";
const b = await puppeteer.launch({executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--hide-scrollbars"]});
const p = await b.newPage();
await p.setViewport({width: 1440, height: 900});
await p.goto("http://localhost:4780/?v=" + Date.now(), {waitUntil: "networkidle0"});
await p.waitForSelector(".hero.scrub-on", {timeout: 15000});
await new Promise(r => setTimeout(r, 800));
const beats = [["scrub-act1.png", 0.04], ["scrub-act2.png", 0.45], ["scrub-act3.png", 0.93]];
for (const [file, prog] of beats) {
  await p.evaluate(pr => {
    const h = document.querySelector("[data-scrub-src]");
    window.scrollTo({top: (h.offsetHeight - innerHeight) * pr, behavior: "instant"});
  }, prog);
  await new Promise(r => setTimeout(r, 1600));
  await p.screenshot({path: file});
  console.log(file, await p.evaluate(() => {
    const h = document.querySelector("[data-scrub-src]");
    const v = h.querySelector("video");
    return `act=${h.getAttribute("data-act")} t=${v.currentTime.toFixed(1)}s`;
  }));
}
await b.close();
