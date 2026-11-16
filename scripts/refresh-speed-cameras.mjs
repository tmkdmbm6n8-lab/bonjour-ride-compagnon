// Run with: node --use-system-ca scripts/refresh-speed-cameras.mjs
import { mkdir, writeFile, readFile } from 'node:fs/promises';
const source = 'https://www.data.gouv.fr/api/1/datasets/r/17f7cfd9-a5fe-4b6a-9f5d-3625feaa396e';
let csv;
if (process.argv[2]) csv = await readFile(process.argv[2], 'utf8');
else {
  const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`Official camera download failed: HTTP ${response.status}`);
  csv = new TextDecoder('windows-1252').decode(await response.arrayBuffer());
}
const cameras = [];
const seen = new Set();
for (const line of csv.split(/\r?\n/).slice(1)) {
  if (!line.trim()) continue;
  const columns = line.split(';').map(value => value.trim().replace(/^"|"$/g, ''));
  if (columns.length !== 6) throw Error('Unexpected camera CSV format');
  const [id, type, , maxspeed, latitude, longitude] = columns;
  const lat = Number(latitude.replace(',', '.')), lng = Number(longitude.replace(',', '.'));
  if (!/^[A-Z0-9]{1,32}$/.test(id) || !/^ET(D|F|T|U|VM|FR|PN)$/.test(type) || !latitude || !longitude || !Number.isFinite(lat) || Math.abs(lat) > 90 || !Number.isFinite(lng) || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) throw Error(`Invalid camera row ${id}`);
  if (seen.has(id)) continue;
  seen.add(id);
  cameras.push({ id, lat, lng, type, maxspeed: /^\d+$/.test(maxspeed) && Number(maxspeed) > 0 ? maxspeed : null });
}
if (cameras.length < 1000) throw Error('Camera dataset unexpectedly small; keeping previous snapshot');
const output = new URL('../src/data/speed-cameras-fr.json', import.meta.url);
await mkdir(new URL('../src/data/', import.meta.url), { recursive: true });
await writeFile(output, JSON.stringify({ source, publisher: "Minist\u00e8re de l\u2019int\u00e9rieur", publishedAt: '2025-12-30', fetchedAt: new Date().toISOString(), license: 'Licence Ouverte 2.0', cameras }) + '\n');
console.log(`${cameras.length} official fixed cameras saved`);

