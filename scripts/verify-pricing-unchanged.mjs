import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const baseline = JSON.parse(
  readFileSync(new URL("../docs/conformite/pricing-integrity.json", import.meta.url), "utf8"),
);
const digest = (value) => createHash("sha256").update(value).digest("hex");
const failures = [];
for (const [path, expected] of Object.entries(baseline)) {
  let text;
  if (path === "vtc.server.js:estimates") {
    const source = readFileSync(new URL("../src/lib/vtc.server.js", import.meta.url), "utf8");
    const from = source.indexOf("async function estimates("),
      to = source.indexOf("export async function handleVtc", from);
    if (from < 0 || to < 0) throw new Error("Bloc de tarification introuvable");
    text = source.slice(from, to);
  } else if (path === "vtc.functions.js:homeEstimate") {
    const source = readFileSync(new URL("../src/lib/vtc.functions.js", import.meta.url), "utf8");
    const from = source.indexOf("export const homeEstimate");
    if (from < 0) throw new Error("Estimation publique introuvable");
    text = source.slice(from);
  } else text = readFileSync(new URL("../" + path, import.meta.url));
  if (digest(text) !== expected) failures.push(path);
}
if (failures.length) {
  console.error("ÉCHEC : éléments de tarification modifiés : " + failures.join(", "));
  process.exitCode = 1;
} else
  console.log(
    "OK : calculs de prix, lien fournisseur et intégrations de devis inchangés (" +
      Object.keys(baseline).length +
      " contrôles).",
  );
