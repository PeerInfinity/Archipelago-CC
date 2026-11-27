// Census (wave 62, read-only): every activator group whose re-publishing setters reach each other — the model's own
// predicate (`levelWorld.presserRecursionGroups` on the built world) beside wave 61's (`-chestcover-evidence/tools/
// census.mjs`), and what ON answers for the room (`buildLevelWorld` with `presserRecursionHang` ON: refused at build,
// or a conditional group a publish would hang). Over: CONTROLS (this slice's staged L38 shapes, the game witness
// rooms), the vanilla atlas, the delivered set (playthrough AP_1, p4g records), every committed generated preset, and a
// GENERATOR SWEEP (`generateSeedlingLevel`, every biome × elements {default, ropegate, holdgate, weighgate, guard} ×
// seeds 1-10, the box gate's bounds). usage: node census.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
const R = '../../../../../frontend/modules/seedlingDemo/';
const { buildLevelWorld, presserRecursionGroups } = await import(`${R}levelWorld.js`);
const { atlasLevelSource } = await import(`${R}levelSource.js`);
const { levelSourceFromAtlas } = await import(`${R}atlasSource.js`);
const { mountedRecordsOf } = await import(`${R}wasmWalkTape.js`);
const { l25Sets } = await import(`${R}fidelityL25ApItem.js`);
const { assembleGeneratedSeedlingSet } = await import(`${R}seedlingGeneratedSet.js`);
const { withContactFidelity } = await import(`${R}contactFidelity.js`);
const { HANG_SHAPES, hangRecord } = await import(`${R}fidelityPresserHang.js`);
const { generateSeedlingLevel } = await import(`${R}procgenSeedling.js`);
const { GENERATE_BIOMES } = await import(`${R}watchGenerate.js`);
const { parseElementSpec } = await import('../../../../../frontend/modules/procgenCore/elementSpec.js');
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const V = atlasLevelSource();
// wave 61's predicate, verbatim (`PUB` + its loop test), for the comparison column.
const PUB = (e) => (e.type === 'button' || e.type === 'rope') ? 'always'
    : (e.type === 'buttonroom' && Number(e.attrs?.room) === -1 ? (Number(e.attrs?.flip) ? 'true-flip1' : 'true') : null);
function wave61(rec) {
    const byT = new Map();
    for (const e of rec.entities) {
        const k = PUB(e);
        if (!k) continue;
        const t = Number(e.attrs?.tset);
        if (!byT.has(t)) byT.set(t, []);
        byT.get(t).push(k);
    }
    let n = 0;
    for (const ks of byT.values()) {
        const a = ks.filter((k) => k === 'always').length, b0 = ks.filter((k) => k === 'true').length, b1 = ks.filter((k) => k === 'true-flip1').length;
        if (a >= 2 || (a >= 1 && b0 >= 1) || (b0 >= 1 && b0 + b1 >= 2)) n++;
    }
    return n;
}
function judge(rec, cleared = null) {
    const w = buildLevelWorld(rec, { cleared });
    const groups = presserRecursionGroups(w);
    let on = 'builds';
    try { withContactFidelity({ presserRecursionHang: true }, () => buildLevelWorld(rec, { cleared })); } catch (e) { on = e.name === 'LevelWorldError' && /PRESSER RECURSION HANG/.test(e.message) ? 'REFUSED' : `THREW ${e.name}`; }
    return { groups, on, w61: wave61(rec) };
}
const fmt = (g) => `t ${g.t}: ${g.members.map((m) => `${m.id}[${m.kind}${m.boot === null ? '' : `,boot ${m.boot}`}]`).join(', ')}`
    + `${g.firstFrame ? ' FIRST-FRAME' : ''}${g.bootBy ? ' AT-BUILD' : ''}${!g.firstFrame && !g.bootBy ? ` on-publish(true${g.falseLoops ? '/false' : ''})` : ''}`;
const grand = { rooms: 0, groups: 0, refused: 0, w61: 0 };
const report = (label, items, control = false) => {
    let rooms = 0, groups = 0, refused = 0, w61 = 0; const lines = [];
    for (const { name, rec, cleared } of items) {
        rooms++;
        const j = judge(rec, cleared);
        groups += j.groups.length; w61 += j.w61; if (j.on === 'REFUSED') refused++;
        if (j.groups.length || j.w61 || j.on !== 'builds') lines.push(`  ${name}: ON ${j.on}; wave-61 predicate ${j.w61}; ${j.groups.map(fmt).join(' | ') || 'no recursion group'}`);
    }
    console.log(`${label}: rooms ${rooms}; recursion groups ${groups}; ON refuses at build ${refused}; wave-61 predicate ${w61}`);
    for (const l of lines) console.log(l);
    if (!control) { grand.rooms += rooms; grand.groups += groups; grand.refused += refused; grand.w61 += w61; }
};
report('CONTROLS (the staged L38 shapes)', HANG_SHAPES.map((s) => ({ name: s.name, rec: hangRecord(V(38), s), cleared: s.clears.length ? s.clears : null })), true);
const levels = (src) => { const out = []; for (let n = 0; n <= 300; n++) { let rec; try { rec = src(n); } catch { continue; } if (rec?.entities) out.push({ name: `L${n}`, rec }); } return out; };
report('vanilla atlas', levels(V));
report('delivered (playthrough AP_1, p4g)', levels(l25Sets(ROOT).deliveredSource));
for (const d of readdirSync(ROOT + 'frontend/presets').filter((n) => n.startsWith('seedling_generated_')).sort()) {
    for (const s of readdirSync(`${ROOT}frontend/presets/${d}`)) {
        const p = `${ROOT}frontend/presets/${d}/${s}/${s}_rules.json`;
        if (!existsSync(p)) continue;
        const set = assembleGeneratedSeedlingSet(JSON.parse(readFileSync(p, 'utf8')), { selfPlayer: 1 }).set;
        report(`generated ${d}/${s}`, levels(levelSourceFromAtlas(mountedRecordsOf(set))));
    }
}
const bounds = { obstacleTarget: 6, triesPerStep: 8, saturationK: 3 };
const gen = []; const refusedGen = {}; let pressersSeen = 0;
for (const biome of Object.keys(GENERATE_BIOMES)) for (const el of [null, 'ropegate', 'holdgate', 'weighgate', 'guard']) for (let seed = 1; seed <= 10; seed++) {
    try {
        const out = generateSeedlingLevel({ seed, palette: GENERATE_BIOMES[biome], bounds, ...(el ? { elements: parseElementSpec(el) } : {}) });
        const n = out.record.entities.filter((e) => ['button', 'buttonroom', 'rope'].includes(e.type)).length;
        pressersSeen += n;
        gen.push({ name: `${biome}/${el ?? 'default'}/seed${seed} (${n} presser${n === 1 ? '' : 's'})`, rec: out.record });
    } catch (e) { const k = `${biome}/${el ?? 'default'}: ${e.name}`; refusedGen[k] = (refusedGen[k] ?? 0) + 1; }
}
report(`GENERATOR SWEEP (${Object.keys(GENERATE_BIOMES).length} biomes × 5 element settings × seeds 1-10; ${gen.length} rooms generated, ${pressersSeen} pressers/ropes placed)`, gen);
console.log(`generator calls that refused (no room, counted, not a census row): ${JSON.stringify(refusedGen)}`);
console.log(`TOTAL (controls excluded) ${JSON.stringify(grand)}`);
