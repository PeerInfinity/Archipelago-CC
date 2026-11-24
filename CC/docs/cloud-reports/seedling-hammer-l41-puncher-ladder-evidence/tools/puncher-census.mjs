// scratch: seed-1 legs (seedling_playthrough leg list) whose region holds a puncher (map entity → partition tile).
import { readFileSync } from 'node:fs';
const R = process.cwd();
const map = JSON.parse(readFileSync(`${R}/frontend/modules/flashPanel/atlases/seedling-map.json`, 'utf8'));
const part = JSON.parse(readFileSync(`${R}/frontend/modules/flashPanel/atlases/seedling-subregion-partition.json`, 'utf8'));
const atlas = Object.values(part.atlases).find((a) => a.atlas === 'seedling-playthrough.json');
const alpha = part.alphabet;
const regionsOf = new Map();
map.levels.forEach((lv, li) => {
    const level = lv.level ?? lv.id ?? li;
    for (const e of (lv.entities ?? [])) {
        if (e.type !== 'puncher') continue;
        const r = atlas.regions[`level_${level}`];
        if (!r) { console.log('no region for level', level); continue; }
        const tx = Math.floor((e.x + 8) / 16) - r.origin[0], ty = Math.floor((e.y + 8) / 16) - r.origin[1];
        const ch = r.rows[ty]?.[tx];
        const sub = ch && ch !== '.' ? r.sub_regions[alpha.indexOf(ch)] : null;
        const region = sub ? `level_${level}__${sub}` : `level_${level}(tile ${tx},${ty} '${ch}')`;
        console.log('PUNCHER', `puncher@${e.x},${e.y}`, region);
        regionsOf.set(region, [...(regionsOf.get(region) ?? []), `puncher@${e.x},${e.y}`]);
    }
});
const legs = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
for (const g of legs) {
    const through = [g.region, ...(g.arrive?.through ?? [])];
    const hit = through.filter((r) => regionsOf.has(r));
    if (hit.length) console.log('LEG', g.id, g.key, '|', hit.map((r) => `${r}:${regionsOf.get(r)}`).join(' '));
}
