// Raw tile types of one level as {"x,y": t} (seedlingSemantics.tileTypeForPlacement over the map's tile layers).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../../..');
const SEM = await import(pathToFileURL(path.join(repo, 'frontend/modules/flashPanel/seedlingSemantics.js')));
const m = JSON.parse(fs.readFileSync(path.join(repo, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const l = m.levels.find((x) => x.level === Number(process.argv[2]));
const o = {};
for (const layer of l.layers) if (layer.name !== 'cliffsides') for (const p of layer.tiles) o[`${p[0]},${p[1]}`] = SEM.tileTypeForPlacement(p);
process.stdout.write(JSON.stringify(o));
