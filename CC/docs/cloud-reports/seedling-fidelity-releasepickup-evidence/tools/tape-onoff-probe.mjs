// Every committed tape OFF vs ON (KEY), plus the census probe's hits (`globalThis.__CENSUS_PROBE`, pushed by a temporary
// line at the two ON sites — copied in and restored): which tapes reach the key's code at all. Usage: KEY=… node …
import { readFileSync, readdirSync } from 'node:fs';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { runTape } from '../../../../../frontend/modules/seedlingDemo/tapeRunner.js';
const dir = new URL('../../../../../frontend/modules/seedlingDemo/fixtures/tapes/', import.meta.url);
const KEY = process.env.KEY ?? 'freezeSpanUpdates';
const names = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
let same = 0; const differ = []; const reached = [];
for (const name of names) {
    const tape = JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8'));
    const go = (on) => withContactFidelity({ [KEY]: on }, () => {
        try { return JSON.stringify(runTape(tape, { levelSource: atlasLevelSource() })); } catch (e) { return `THROW ${e.message}`; }
    });
    const off = go(false);
    globalThis.__CENSUS_PROBE = [];
    const on = go(true);
    if (globalThis.__CENSUS_PROBE.length > 0) reached.push(`${name}: ${globalThis.__CENSUS_PROBE.join('; ')}`);
    if (off === on) same += 1; else differ.push(name);
}
console.log(`${names.length} committed tapes, KEY=${KEY}: ${same} ON = OFF, ${differ.length} differ ${JSON.stringify(differ)}`);
console.log(`census probe: ${reached.length} tape(s) reach an ON site`);
for (const r of reached) console.log('  ' + r);
