/**
 * Region Map link-ends census (region-map-link-ends): for every committed preset, the link SET the model draws
 * (`model.links` + `model.neighbourLinks`, as JSON, with its md5) and, with the panel's own `linkShape`, how many are
 * drawn as a GAP mark (adjacent cells) or a clipped LINE, how many carry an arrowhead, and the non-join links between
 * adjacent cells, per kind.
 *
 *   node scripts/dev/census-region-map-link-ends.mjs [--root=<dir holding frontend/>] [--out=<file.json>] [--sets]
 *
 * `--root` points the model at another tree (e.g. `git archive <base> frontend | tar -x -C <dir>`, with the
 * `frontend/modules/shared` submodule copied in), to compare the link SET at base; `linkShape` is then skipped when that
 * tree has no `regionMapLinkGeometry.js`. `--sets` writes each preset's full link JSON too.
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const arg = (n, d = null) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const ROOT = resolve(arg('root', '.'));
const OUT = arg('out', null);
const SETS = process.argv.includes('--sets');
const mod = (p) => import(pathToFileURL(join(ROOT, 'frontend/modules', p)).href);

const { buildRegionMapModel } = await mod('regionMap/regionMapModel.js');
const { cellFrames } = await mod('regionMap/regionMapFrames.js');
const geomPath = join(ROOT, 'frontend/modules/regionMap/regionMapLinkGeometry.js');
const geom = existsSync(geomPath) ? await mod('regionMap/regionMapLinkGeometry.js') : null;
await mod('flashPanel/flashSeedlingLibrary.js');
await mod('flashPanel/flashSeedlingGenLibrary.js');

const presetsDir = join(ROOT, 'frontend/presets');
const out = {};
for (const game of readdirSync(presetsDir).sort()) {
    const gdir = join(presetsDir, game);
    if (!statSync(gdir).isDirectory()) continue;
    for (const seed of readdirSync(gdir).filter((s) => s.startsWith('AP_')).sort()) {
        const rulesFile = join(gdir, seed, `${seed}_rules.json`);
        if (!existsSync(rulesFile)) continue;
        const id = `${game}/${seed}`;
        let model;
        try {
            const rules = JSON.parse(readFileSync(rulesFile, 'utf8'));
            model = buildRegionMapModel({ rules });
        } catch (e) {
            out[id] = { error: String(e?.message ?? e) };
            continue;
        }
        const set = JSON.stringify({ links: model.links, neighbourLinks: model.neighbourLinks ?? [] });
        const row = {
            md5: createHash('md5').update(set).digest('hex'),
            groups: model.layout.groups.length, links: model.links.length, neighbourLinks: (model.neighbourLinks ?? []).length,
        };
        if (geom) {
            const frames = cellFrames(model.layout.positions, new Map([...model.cells].map(([k, c]) => [k, c.extent])), 'level');
            const c = { gap: 0, line: 0, heads: 0, gapJoin: 0, gapHeaded: {}, lineJoin: 0, crossGroupJoin: 0, none: 0 };
            for (const l of [...model.links, ...(model.neighbourLinks ?? [])]) {
                const s = geom.linkShape(l, frames);
                if (!s) { c.none += 1; continue; }
                c[s.form] += 1;
                if (s.head) c.heads += 1;
                if (s.form === 'gap' && !s.head) c.gapJoin += 1;
                if (s.form === 'gap' && s.head) c.gapHeaded[l.kind] = (c.gapHeaded[l.kind] ?? 0) + 1;
                if (s.form === 'line' && l.kind === 'join') c.lineJoin += 1;
                if (!l.neighbour && l.kind === 'join') c.crossGroupJoin += 1;
            }
            row.shapes = c;
        }
        if (SETS) row.set = set;
        out[id] = row;
    }
}
const ids = Object.keys(out);
const total = ids.reduce((t, id) => {
    const s = out[id].shapes;
    if (s) for (const k of ['gap', 'line', 'heads', 'gapJoin', 'lineJoin', 'crossGroupJoin', 'none']) t[k] = (t[k] ?? 0) + s[k];
    return t;
}, {});
const summary = { root: ROOT, presets: ids.length, errors: ids.filter((id) => out[id].error).length, total };
if (OUT) writeFileSync(OUT, JSON.stringify({ summary, presets: out }, null, 1));
console.log(JSON.stringify(summary));
