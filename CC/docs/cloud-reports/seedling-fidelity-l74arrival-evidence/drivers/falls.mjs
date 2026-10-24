const REPO = '/home/user/Archipelago-CC';
const M = (p) => import(`${REPO}/frontend/modules/seedlingDemo/${p}`);
const { atlasLevelSource, loadAtlas } = await M('levelSource.js');
const { buildLevelWorld, ROLES } = await M('levelWorld.js');
const src = atlasLevelSource(); const atlas = loadAtlas();
const levels = (Array.isArray(atlas.levels) ? atlas.levels.map((l) => l.level) : Object.keys(atlas.levels).map(Number));
const out = [];
for (const L of levels) { const w = buildLevelWorld(src(L), { roles: ROLES }); if (w.fallthrough) out.push([L, JSON.stringify(w.fallthrough)]); }
console.log(out.filter(([, f]) => /"level":(29|74)\b/.test(f) || true).map((r) => r.join(' ')).join('\n'));
