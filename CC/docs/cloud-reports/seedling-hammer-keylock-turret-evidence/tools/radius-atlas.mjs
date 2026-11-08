// scratch (KEYLOCK-TURRET I): the switch's possible reach in the committed atlas — every level holding both an ice
// turret and a keylock (`bosslock`), with each lock's key-line centre distance to each turret's disc centre (129 px).
const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { atlasLevelSource } = await import(R + 'levelSource.js');
const src = atlasLevelSource();
const out = [];
for (let level = 0; level < 200; level += 1) {
    let lv; try { lv = src(level); } catch { continue; }
    if (!lv?.entities) continue;
    const turrets = lv.entities.filter((e) => e.type === 'iceturret');
    const locks = lv.entities.filter((e) => e.type === 'bosslock');
    if (!turrets.length) continue;
    out.push({ level, turrets: turrets.map((t) => `${t.x},${t.y}`), locks: locks.map((l) => {
        const kx = l.x + 8; const ky = l.y + 17;
        return { lock: `bosslock@${l.x},${l.y}`, d: turrets.map((t) => Math.round(Math.hypot(kx - (t.x + 16), ky - (t.y + 16)))) };
    }) });
}
for (const r of out) console.log(JSON.stringify(r));
