import { readFileSync } from 'node:fs';
import { setModelBuildDefault } from 'frontend/modules/seedlingDemo/modelBuild.js';
const b = JSON.parse(readFileSync('frontend/modules/flashPanel/wasm/builds.json','utf8')).builds.find((x) => x.name === 'seedling_bot_ap_p4h');
setModelBuildDefault(b.capabilities);
console.error('[preload] model default = p4h', b.capabilities.includes('bossdraws'));
