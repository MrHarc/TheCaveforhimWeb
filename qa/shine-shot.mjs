import puppeteer from "npm:puppeteer-core@23";
const b = await puppeteer.launch({executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--hide-scrollbars"]});
const p = await b.newPage();
await p.setViewport({width: 1440, height: 900});
await p.goto("http://localhost:4780/?sh=" + Date.now(), {waitUntil: "domcontentloaded", timeout: 60000});
await new Promise(r => setTimeout(r, 2600));
// restart animation deterministically, then catch mid-sweep on the hero button
await p.evaluate(() => {
  const btn = document.querySelector(".hero__persist .btn--primary");
  btn.style.setProperty("--x", "1");
  btn.animate ? null : null;
  document.querySelectorAll(".btn--primary").forEach(el => { el.style.animation = "none"; });
});
await p.evaluate(() => {
  const s = document.createElement("style");
  s.textContent = ".btn--primary::after{animation: btn-shine 2s linear infinite !important}";
  document.head.appendChild(s);
});
for (const [f, d] of [["shine-1.png", 300], ["shine-2.png", 300], ["shine-3.png", 300]]) {
  await new Promise(r => setTimeout(r, d));
  const el = await p.$(".hero__persist");
  await el.screenshot({path: f});
}
await b.close(); console.log("ok");
