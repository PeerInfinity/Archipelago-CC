// omsi-stats: mint ratio-parameterized world-config files for the
// shuffle-scope curve sweeps (cross-game §9b / §8 posture ruling).
//
// Thin CLI over the GENERATOR'S OWN generateOmsiAwardSchedule — the curves
// must measure the schedules the generator actually mints (same draw order,
// same horizon, same pool shape), not a hand-rolled approximation; a
// verifier sharing only the carrier's vocabulary but not the generator's
// draws would measure a different world than players get.
//
// Output shape is the WRAPPED --world-config form ({awardSchedule, meta});
// meta records the knobs and the REALIZED shuffle fraction per lootable —
// the §9b lesson is that realized ≠ nominal, and the curve x-axis should be
// the realized fraction. loadWorldConfig ignores meta; lootPrefs is left
// absent so --loot-policy stays in control.
//
// Usage:
//   node CC/scripts/omsi-stats/mint-world-config.mjs --weight 0.9
//   node CC/scripts/omsi-stats/mint-world-config.mjs --weight 1,0.95,0.9,0.85,0.7,0.5 \
//       --out-dir worlds/curves            # one file per weight: w095.json, ...
//   node CC/scripts/omsi-stats/mint-world-config.mjs --weight 0.9 --dummy 0.05 \
//       --schedule-seed 2 --foreign jta:Food,jta:Coin --out worlds/foo.json
//
// Defaults: --schedule-seed 1, --dummy 0, --foreign jta:Food,jta:Coin (a
// representative co-present-substrate pool; generated worlds derive theirs
// from the registry, but the POOL SHAPE — local numerics ∪ foreign — comes
// from the generator either way). Weight 1 + dummy 0 mints null (byte-inert)
// and is refused with a pointer at running plain instead.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../..");

const args = process.argv.slice(2);
const val = (flag, dflt) => {
    const i = args.indexOf(flag);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : dflt;
};

const weights = String(val("--weight", "")).split(",").map((s) => s.trim()).filter(Boolean).map(Number);
const dummy = Number(val("--dummy", "0"));
const scheduleSeed = Number(val("--schedule-seed", "1"));
const foreign = String(val("--foreign", "jta:Food,jta:Coin")).split(",").map((s) => s.trim()).filter(Boolean)
    .map((pair) => {
        const [substrate, type] = pair.split(":");
        if (!substrate || !type) throw new Error(`--foreign entry "${pair}" is not substrate:type`);
        return { substrate, type };
    });
const outFile = val("--out", null);
const outDir = val("--out-dir", null);

if (!weights.length || weights.some((w) => !(w >= 0 && w <= 1))) {
    console.error("--weight is required: one or more originalItemWeight values in [0,1], comma-separated");
    process.exit(1);
}
if (weights.length > 1 && outFile) {
    console.error("--out is single-file; use --out-dir with a --weight list");
    process.exit(1);
}

const { generateOmsiAwardSchedule } = await import(pathToFileURL(
    path.join(repoRoot, "frontend/modules/omsiSubstrateWrapper/generateAwardSchedule.js")).href);

function realizedFractions(schedule) {
    const out = {};
    for (const varName of Object.keys(schedule?.lootables ?? {})) {
        const contents = schedule.lootables[varName].contents;
        const shuffled = contents.filter((e) => e != null).length;
        out[varName] = { horizon: contents.length, shuffled, realized: shuffled / contents.length };
    }
    return out;
}

for (const weight of weights) {
    const schedule = generateOmsiAwardSchedule({
        seed: scheduleSeed, originalItemWeight: weight, dummyItemRatio: dummy, foreignTypes: foreign,
    });
    if (schedule === null) {
        console.error(`weight ${weight} / dummy ${dummy}: generator minted null (byte-inert draw) — ` +
            "nothing to write; a control arm should just run WITHOUT --world-config");
        continue;
    }
    const realized = realizedFractions(schedule);
    const payload = {
        meta: {
            tool: "mint-world-config.mjs",
            knobs: { originalItemWeight: weight, dummyItemRatio: dummy, scheduleSeed, foreign },
            realized,
        },
        awardSchedule: schedule,
    };
    const name = outFile ?? path.join(outDir ?? path.join(here, "worlds"),
        `w${String(weight).replace(/^0?\./, "0")}${dummy ? `-d${String(dummy).replace(/^0?\./, "0")}` : ""}` +
        `${scheduleSeed !== 1 ? `-s${scheduleSeed}` : ""}.json`);
    const resolved = path.isAbsolute(name) ? name : path.join(here, name);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, JSON.stringify(payload, null, 2) + "\n");
    const summary = Object.entries(realized)
        .map(([v, r]) => `${v} ${r.shuffled}/${r.horizon} (${(r.realized * 100).toFixed(1)}%)`).join(", ");
    console.log(`${resolved}  realized: ${summary}`);
}
