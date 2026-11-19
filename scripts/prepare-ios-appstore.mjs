#!/usr/bin/env node
// Run after "npx cap add ios" / "npx cap sync ios" on macOS.
// Idempotently sets iOS App Store review-related Info.plist keys.
// This does not certify export-compliance eligibility; review encryption usage first.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const plistPath = resolve("ios/App/App/Info.plist");
if (!existsSync(plistPath)) {
  console.error("Info.plist introuvable. Exécutez d'abord : npx cap add ios (si nécessaire), puis npx cap sync ios.");
  process.exit(1);
}
let xml = readFileSync(plistPath, "utf8");
if (!xml.includes("</dict>")) throw new Error("Info.plist invalide : balise </dict> manquante.");
const entries = [
  ["ITSAppUsesNonExemptEncryption", "<false/>"],
  ["UIStatusBarStyle", "<string>UIStatusBarStyleLightContent</string>"],
  ["UIViewControllerBasedStatusBarAppearance", "<false/>"],
];
for (const [key, value] of entries) {
  const pattern = new RegExp(`(<key>\\s*${key}\\s*</key>\\s*)(?:<true\\s*/>|<false\\s*/>|<string>[^<]*</string>)`);
  if (pattern.test(xml)) xml = xml.replace(pattern, (_, prefix) => prefix + value);
  else xml = xml.replace("</dict>", `  <key>${key}</key>\n  ${value}\n</dict>`);
}
writeFileSync(plistPath, xml);
console.log("Info.plist mis à jour :", plistPath);
console.log("IMPORTANT : ITSAppUsesNonExemptEncryption=false est valide seulement si l'application est admissible à l'exemption.");
