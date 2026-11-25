// Replay committed tapes through the model OFF and ON (`chestCoverFencepost`), diff the whole result, and name every
// tape whose run opens a chest (`chestOpens`) — wave 56's tape-onoff tool, re-keyed (wave 60's copy, re-keyed again).
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
const openers = [];
for (const name of names) {
    const tape = JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8'));
    const go = (on) => withContactFidelity({ ...over, chestCoverFencepost: on }, () => {
        try { return runTape(tape, { levelSource: atlasLevelSource() }); } catch (e) { return { THROW: e.message }; }
    });
    const offR = go(false);
    const onR = go(true);
    const off = JSON.stringify(offR);
    const on = JSON.stringify(onR);
    if (off === on) same++; else differ++;
    const opens = offR?.chestOpens ?? offR?.result?.chestOpens ?? null;
    if (Array.isArray(opens) && opens.length) openers.push(`${name} ${JSON.stringify(opens)}`);
    console.log(name, off === on ? 'ON = OFF (byte-identical result)' : 'DIFFERS', off.length, on.length);
}
console.log(`OVER ${JSON.stringify(over)} tapes ${names.length}: identical ${same}, differ ${differ}`);
console.log(`tapes whose OFF run opens a chest: ${openers.length}`);
for (const o of openers) console.log('  ' + o);
