/* Pixel-compare two desktop capture dirs produced by desktop-baseline.mjs.
   Usage: QA_RIG=<dir-containing-node_modules> node qa/desktop-diff.mjs <baselineDir> <finalDir> [diffOutDir]
   Exit 1 if any pair differs by more than 0 changed pixels (threshold 0 —
   same machine, same engine, same DPR, so identical rendering is expected). */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(process.env.QA_RIG ? process.env.QA_RIG + "/" : import.meta.url);
const { PNG } = require("pngjs");
const pixelmatch = require("pixelmatch").default ?? require("pixelmatch");

const [a, b, out] = process.argv.slice(2);
if (!a || !b) { console.error("need <baselineDir> <finalDir>"); process.exit(2); }
if (out) mkdirSync(out, { recursive: true });
let bad = 0, total = 0;
for (const f of readdirSync(a).filter((f) => f.endsWith(".png")).sort()) {
  if (!existsSync(`${b}/${f}`)) { console.log(`MISSING in final: ${f}`); bad++; continue; }
  const pa = PNG.sync.read(readFileSync(`${a}/${f}`));
  const pb = PNG.sync.read(readFileSync(`${b}/${f}`));
  total++;
  if (pa.width !== pb.width || pa.height !== pb.height) {
    console.log(`SIZE CHANGED ${f}: ${pa.width}x${pa.height} -> ${pb.width}x${pb.height}`);
    bad++; continue;
  }
  const diff = new PNG({ width: pa.width, height: pa.height });
  const n = pixelmatch(pa.data, pb.data, diff.data, pa.width, pa.height, { threshold: 0.05 });
  if (n > 0) {
    console.log(`DIFF ${f}: ${n} px`);
    if (out) writeFileSync(`${out}/${f}`, PNG.sync.write(diff));
    bad++;
  }
}
console.log(bad === 0 ? `OK — ${total} pairs, zero changed pixels` : `${bad} of ${total} pairs differ`);
process.exit(bad === 0 ? 0 : 1);
