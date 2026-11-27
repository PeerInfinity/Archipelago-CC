// Census (wave 63, read-only): every activator group that holds a ButtonRoom AND another publisher of a TRUE into
// that group — a Button, a RopeStart, another `room == -1` flip-0 ButtonRoom, the wand's tset-0 sweep (a `wand` in the
// room), the FinalBoss's `Button.activateAll(null, 0, true)` (a `finalboss` in the room → group 0). Those are the
// groups where a ButtonRoom can be REACHED BY A PUBLISH (its setter run by another caller). Split by the reached
// ButtonRoom's `room` (-1 local / >=0 cross-room) and `flip`, with the group's responders (the lanes the model has).
// Over: CONTROLS (the staged L38 shapes of this wave and wave 62), the vanilla atlas, the delivered set, every
// committed generated preset, and the generator sweep (every GENERATE_BIOMES biome × elements {default, ropegate,
// holdgate, weighgate, guard} × seeds 1-20, the box gate's bounds). usage: node census.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const R = '../../../../../frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(`${R}levelSource.js`);
const { levelSourceFromAtlas } = await import(`${R}atlasSource.js`);
const { mountedRecordsOf } = await import(`${R}wasmWalkTape.js`);
const { l25Sets } = await import(`${R}fidelityL25ApItem.js`);
const { assembleGeneratedSeedlingSet } = await import(`${R}seedlingGeneratedSet.js`);
const { HANG_SHAPES, hangRecord } = await import(`${R}fidelityPresserHang.js`);
const { generateSeedlingLevel } = await import(`${R}procgenSeedling.js`);
const { GENERATE_BIOMES } = await import(`${R}watchGenerate.js`);
const { parseElementSpec } = await import('../../../../../frontend/modules/procgenCore/elementSpec.js');
let SHAPES = [];
try { SHAPES = (await import(`${R}fidelityPublishedButtonRoom.js`)).BR_SHAPES; } catch { /* before D2 */ }
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const V = atlasLevelSource();
const RESP = new Set(['lock', 'wandlock', 'grasslock', 'cover', 'rocklock', 'fallrock', 'fallrocklarge', 'pulser', 'arrowtrap', 'crusher', 'lightpole', 'bosslock']);
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
function groupsOf(rec) {
    const byT = new Map();
    const add = (t, m) => { if (!byT.has(t)) byT.set(t, { brs: [], pubs: [], resp: [] }); return byT.get(t); };
    for (const e of rec.entities) {
        const id = `${e.type}@${e.x},${e.y}`;
        if (e.type === 'buttonroom') {
            const room = num(e.attrs?.room, -1), flip = num(e.attrs?.flip, 0) !== 0;
            const g = add(num(e.attrs?.tset, 0));
            g.brs.push({ id, room, flip, tag: num(e.attrs?.tag, -1) });
            if (room === -1 && !flip) g.pubs.push({ id, kind: 'br0' });
        } else if (e.type === 'button') add(num(e.attrs?.tset, 0)).pubs.push({ id, kind: 'button' });
        else if (e.type === 'rope') add(num(e.attrs?.tset, 0)).pubs.push({ id, kind: 'rope' });
        else if (e.type === 'wand') add(0).pubs.push({ id, kind: 'wand(tset 0)' });
        else if (e.type === 'finalboss') add(0).pubs.push({ id, kind: 'finalboss(activateAll 0)' });
        else if (RESP.has(e.type) && e.attrs?.tset !== undefined) add(num(e.attrs.tset, 0)).resp.push(id);
    }
    const out = [];
    for (const [t, g] of byT) {
        for (const br of g.brs) {
            const others = g.pubs.filter((p) => p.id !== br.id);
            if (others.length) out.push({ t, br, others, resp: g.resp });
        }
    }
    return out;
}
const split = {};
const grand = { rooms: 0, rooms_with: 0, reached: 0 };
const report = (label, items, control = false) => {
    let rooms = 0, withN = 0, reached = 0; const lines = [];
    for (const { name, rec } of items) {
        rooms++;
        const g = groupsOf(rec);
        if (g.length) withN++;
        reached += g.length;
        for (const x of g) {
            const k = `room ${x.br.room >= 0 ? '>=0' : '-1'} flip ${x.br.flip ? 1 : 0}`;
            if (!control) split[k] = (split[k] ?? 0) + 1;
            lines.push(`  ${name}: t ${x.t}: ${x.br.id}[room ${x.br.room}, flip ${+x.br.flip}, tag ${x.br.tag}] reached by ${x.others.map((o) => `${o.id}[${o.kind}]`).join(', ')}; responders ${x.resp.join(', ') || 'none'}`);
        }
    }
    console.log(`${label}: rooms ${rooms}; rooms holding a reachable ButtonRoom ${withN}; reachable ButtonRooms ${reached}`);
    for (const l of lines) console.log(l);
    if (!control) { grand.rooms += rooms; grand.rooms_with += withN; grand.reached += reached; }
};
report('CONTROLS (wave 62 HANG_SHAPES)', HANG_SHAPES.map((s) => ({ name: s.name, rec: hangRecord(V(38), s) })), true);
if (SHAPES.length) report('CONTROLS (wave 63 BR_SHAPES)', SHAPES.map((s) => ({ name: s.name, rec: hangRecord(V(38), s) })), true);
const levels = (src) => { const out = []; for (let n = 0; n <= 300; n++) { let rec; try { rec = src(n); } catch { continue; } if (rec?.entities) out.push({ name: `L${n}`, rec }); } return out; };
const brCount = (items) => items.reduce((a, { rec }) => a + rec.entities.filter((e) => e.type === 'buttonroom').length, 0);
const van = levels(V);
console.log(`(vanilla ButtonRooms in all: ${brCount(van)})`);
report('vanilla atlas', van);
const del = levels(l25Sets(ROOT).deliveredSource);
console.log(`(delivered ButtonRooms in all: ${brCount(del)})`);
report('delivered (playthrough AP_1, p4g)', del);
for (const d of readdirSync(ROOT + 'frontend/presets').filter((n) => n.startsWith('seedling_generated_')).sort()) {
    for (const s of readdirSync(`${ROOT}frontend/presets/${d}`)) {
        const p = `${ROOT}frontend/presets/${d}/${s}/${s}_rules.json`;
        if (!existsSync(p)) continue;
        const set = assembleGeneratedSeedlingSet(JSON.parse(readFileSync(p, 'utf8')), { selfPlayer: 1 }).set;
        report(`generated ${d}/${s}`, levels(levelSourceFromAtlas(mountedRecordsOf(set))));
    }
}
const bounds = { obstacleTarget: 6, triesPerStep: 8, saturationK: 3 };
const gen = []; const refusedGen = {}; let brs = 0, pubs = 0;
for (const biome of Object.keys(GENERATE_BIOMES)) for (const el of [null, 'ropegate', 'holdgate', 'weighgate', 'guard']) for (let seed = 1; seed <= 20; seed++) {
    try {
        const out = generateSeedlingLevel({ seed, palette: GENERATE_BIOMES[biome], bounds, ...(el ? { elements: parseElementSpec(el) } : {}) });
        brs += out.record.entities.filter((e) => e.type === 'buttonroom').length;
        pubs += out.record.entities.filter((e) => ['button', 'rope'].includes(e.type)).length;
        gen.push({ name: `${biome}/${el ?? 'default'}/seed${seed}`, rec: out.record });
    } catch (e) { const k = `${biome}/${el ?? 'default'}: ${e.name}`; refusedGen[k] = (refusedGen[k] ?? 0) + 1; }
}
report(`GENERATOR SWEEP (${Object.keys(GENERATE_BIOMES).length} biomes × 5 element settings × seeds 1-20; ${gen.length} rooms; ${brs} ButtonRooms, ${pubs} buttons/ropes placed)`, gen);
console.log(`generator calls that refused (no room): ${JSON.stringify(refusedGen)}`);
console.log(`SPLIT (controls excluded) ${JSON.stringify(split)}`);
console.log(`TOTAL (controls excluded) ${JSON.stringify(grand)}`);
