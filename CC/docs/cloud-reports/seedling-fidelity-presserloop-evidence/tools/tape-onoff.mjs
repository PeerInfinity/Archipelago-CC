// Replay committed tapes through the model OFF and ON (`presserRecursionHang`), diff the whole result (wave 56's
// tape-onoff tool, as re-keyed by waves 60 and 61). OVER='{"k":true}' adds switches to BOTH arms.
// usage: node tape-onoff.mjs [<tape-name> ...]   (no names: every committed tape)
import { readFileSync, readdirSync } from 'node:fs';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { runTape } from '../../../../../frontend/modules/seedlingDemo/tapeRunner.js';
const root = new URL('../../../../../', import.meta.url);
const dir = new URL('frontend/modules/seedlingDemo/fixtures/tapes/', root);
const names = process.argv.length > 2 ? process.argv.slice(2)
    : readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
const over = JSON.parse(process.env.OVER ?? '{}');
let same = 0, differ = 0;
for (const name of names) {
    const tape = JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8'));
    const go = (on) => withContactFidelity({ ...over, presserRecursionHang: on }, () => {
        try { return runTape(tape, { levelSource: atlasLevelSource() }); } catch (e) { return { THROW: `${e.name}: ${e.message}` }; }
    });
    const off = JSON.stringify(go(false));
    const on = JSON.stringify(go(true));
    if (off === on) same++; else differ++;
    console.log(name, off === on ? 'ON = OFF (byte-identical result)' : 'DIFFERS', off.length, on.length);
}
console.log(`OVER ${JSON.stringify(over)} tapes ${names.length}: identical ${same}, differ ${differ}`);
