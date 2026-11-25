// Replay committed tapes through the model OFF and ON (`apChestCoverOrder`), and diff the whole stream + ledgers
// (wave 56's tape-onoff tool, re-keyed). BUILD=p4h runs both arms under `setModelBuildDefault(<p4h capabilities>)`.
// usage: [BUILD=p4h] node tape-onoff.mjs <tape-name> [...]   (no names: every committed tape)
import { readFileSync, readdirSync } from 'node:fs';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { runTape } from '../../../../../frontend/modules/seedlingDemo/tapeRunner.js';
import { setModelBuildDefault } from '../../../../../frontend/modules/seedlingDemo/modelBuild.js';
const root = new URL('../../../../../', import.meta.url);
const dir = new URL('frontend/modules/seedlingDemo/fixtures/tapes/', root);
if (process.env.BUILD === 'p4h') {
    const m = JSON.parse(readFileSync(new URL('frontend/modules/flashPanel/wasm/builds.json', root), 'utf8'));
    setModelBuildDefault(m.builds.find((b) => b.name === 'seedling_bot_ap_p4h').capabilities);
}
const names = process.argv.length > 2 ? process.argv.slice(2)
    : readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
let same = 0, differ = 0;
for (const name of names) {
    const tape = JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8'));
    const go = (on) => withContactFidelity({ apChestCoverOrder: on }, () => {
        try { return JSON.stringify(runTape(tape, { levelSource: atlasLevelSource() })); } catch (e) { return `THROW ${e.message}`; }
    });
    const off = go(false);
    const on = go(true);
    if (off === on) same++; else differ++;
    console.log(name, off === on ? 'ON = OFF (byte-identical result)' : 'DIFFERS', off.length, on.length);
}
console.log(`BUILD=${process.env.BUILD ?? 'p4g'} tapes ${names.length}: identical ${same}, differ ${differ}`);
