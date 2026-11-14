// scratch: print activators / killLocks / lock solids / combat census of levels (default: all with a kill lock).
const ROOT = process.env.ROOT ?? '/home/user/Archipelago-CC';
const M = ROOT + '/frontend/modules/seedlingDemo/';
import { readFileSync } from 'node:fs';
const { buildLevelWorld } = await import(M + 'levelWorld.js');
const map = JSON.parse(readFileSync(ROOT + '/frontend/modules/flashPanel/atlases/seedling-map.json', 'utf8'));
const want = process.argv.slice(2).map(Number);
for (const rec of map.levels) {
    if (want.length && !want.includes(rec.level)) continue;
    let w;
    try { w = buildLevelWorld(rec, { roles: ['solid', 'activators', 'combat', 'pressers'] }); } catch (e) { try { w = buildLevelWorld(rec); } catch (e2) { console.log(rec.level, 'BUILD FAIL', e2.message.slice(0, 200)); continue; } }
    const kl = w.combat?.killLocks ?? [];
    if (!want.length && kl.length === 0) continue;
    console.log(`L${rec.level} killLocks=${JSON.stringify(kl.map((k) => ({ tag: k.tag, x: k.x, y: k.y, flag: k.flag })))} bill=[${(w.combat?.bill ?? []).map((e) => `${e.tag}@${e.x},${e.y}`).join(' ')}]`);
    if (want.length) {
        console.log('  activators', JSON.stringify(w.activators));
        console.log('  pressers', JSON.stringify(w.pressers));
        console.log('  lock solids', JSON.stringify((w.solids ?? []).filter((s) => /lock/.test(s.tag ?? ''))));
    }
}
