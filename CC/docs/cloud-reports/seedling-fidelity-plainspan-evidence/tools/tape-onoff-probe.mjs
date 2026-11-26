// Every committed tape OFF vs ON (KEY, plus the keys in EXTRA, comma-separated, ON on both sides), and the census
// probe's hits (`globalThis.__CENSUS_PROBE`, pushed by a temporary line at the ON site — copied in and restored).
// Usage: KEY=plainPickupInFreeze [EXTRA=a,b] node tools/tape-onoff-probe.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { runTape } from '../../../../../frontend/modules/seedlingDemo/tapeRunner.js';
const dir = new URL('../../../../../frontend/modules/seedlingDemo/fixtures/tapes/', import.meta.url);
const KEY = process.env.KEY ?? 'plainPickupInFreeze';
const extra = Object.fromEntries((process.env.EXTRA ?? '').split(',').filter(Boolean).map((k) => [k, true]));
const names = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
let same = 0; const differ = []; const reached = []; let frameA = 0;
for (const name of names) {
    const tape = JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8'));
    const go = (on) => withContactFidelity({ ...extra, [KEY]: on }, () => {
        try { return JSON.stringify(runTape(tape, { levelSource: atlasLevelSource() })); } catch (e) { return `THROW ${e.message}`; }
    });
    const off = go(false);
    globalThis.__CENSUS_PROBE = [];
    globalThis.__PLAIN_ASKS = 0;
    const on = go(true);
    frameA += globalThis.__PLAIN_ASKS ?? 0;
    if (globalThis.__CENSUS_PROBE.length > 0) reached.push(`${name}: ${globalThis.__CENSUS_PROBE.join('; ')}`);
    if (off === on) same += 1; else differ.push(name);
}
console.log(`${names.length} committed tapes, KEY=${KEY}${process.env.EXTRA ? ` (+ ${process.env.EXTRA} on both sides)` : ''}: ${same} ON = OFF, ${differ.length} differ ${JSON.stringify(differ)}`);
console.log(`census probe: ${reached.length} tape(s) reach the ON site; ON-site asks (ON, with apitems in the room or not): ${frameA}`);
for (const r of reached) console.log('  ' + r);
