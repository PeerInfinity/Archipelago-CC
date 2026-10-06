/**
 * The TRAINING section of the host-side Noiz2sa panel (slice N4; ⚖ 2026-10-05: a section of the host panel, outside the
 * iframe, so it is there between regions and across loop resets). It shows the bot's five tracks (position and the
 * next step's price), the unspent points, the spending strategy, a buy button per track (strategy "By hand"),
 * Respec (free), and the surplus → region XP.
 *
 * `createTrainingSection(service, {xpTarget, addRegionXp})`: `service` is noiz2saTraining.js createTrainerService;
 * `xpTarget()` names the region the surplus boosts (the last Noiz2sa region loaded) or null; `addRegionXp(region,
 * xp)` gives it. → {root, render}. The host module calls render() on every trainer change.
 */
import { STRATEGIES, STRATEGY_LABEL, TRACKS, TRACK_MAX, nextStepCost, atCeiling } from './noiz2saTraining.js';

const fmt = (n) => (Math.abs(n) >= 100 ? n.toFixed(0) : n.toFixed(1));

export function createTrainingSection(service, { xpTarget = () => null, addRegionXp = () => {} } = {}) {
    const root = document.createElement('div');
    root.className = 'noiz2sa-training';
    root.dataset.testid = 'noiz2sa-training';
    root.innerHTML = `
      <div class="n2t-head">
        <strong>Bot training</strong>
        <span class="n2t-points" data-role="points"></span>
      </div>
      <div class="n2t-tracks" data-role="tracks"></div>
      <div class="n2t-row">
        <label>Strategy <select data-role="strategy"></select></label>
        <button type="button" data-role="respec" title="Every track back to 0, every point spent back (free)">Respec</button>
      </div>
      <div class="n2t-row">
        <span data-role="surplus"></span>
        <button type="button" data-role="boost"></button>
      </div>`;
    const $ = (r) => root.querySelector(`[data-role="${r}"]`);
    const select = $('strategy');
    for (const s of STRATEGIES) {
        const o = document.createElement('option');
        o.value = s; o.textContent = STRATEGY_LABEL[s] ?? s;
        select.appendChild(o);
    }
    select.addEventListener('change', () => service.setStrategy(select.value));
    $('respec').addEventListener('click', () => service.respec());
    $('boost').addEventListener('click', () => {
        const region = xpTarget();
        if (region) service.boostXp((xp) => addRegionXp(region, xp));
    });

    const rows = {};
    for (const k of TRACKS) {
        const row = document.createElement('div');
        row.className = 'n2t-track';
        row.dataset.track = k;
        row.innerHTML = `<span class="n2t-name">${k}</span><span class="n2t-bar"><span class="n2t-fill"></span></span>`
            + '<span class="n2t-pos"></span><button type="button" class="n2t-buy"></button>';
        row.querySelector('button').addEventListener('click', () => service.buy(k));
        $('tracks').appendChild(row);
        rows[k] = row;
    }

    function render() {
        const tr = service.trainer;
        // N5: points come from the mana spent in Noiz2sa regions, at this pace (the trainer's per-"second" rate is per mana)
        // ⚖ follow-up: a visit's points apply when the visit ends
        const pending = service.pendingPoints ?? 0;
        $('points').textContent = `${fmt(tr.unspent)} points unspent · ${fmt(tr.earned)} earned · ${fmt(tr.settings.pointsPerSecond)} per mana`
            + (pending > 0 ? ` · +${fmt(pending)} when this visit ends` : '');
        select.value = tr.strategy;
        const manual = tr.strategy === 'manual';
        for (const k of TRACKS) {
            const row = rows[k], pos = tr.tracks[k], cost = nextStepCost(tr, k);
            row.querySelector('.n2t-fill').style.width = `${(100 * pos) / TRACK_MAX}%`;
            row.querySelector('.n2t-pos').textContent = `${pos}/${TRACK_MAX}`;
            const b = row.querySelector('button');
            b.textContent = cost === null ? 'max' : `+1 (${fmt(cost)})`;
            b.title = manual ? 'Buy one step of this track' : 'Choose the strategy "By hand" to buy steps yourself';
            b.disabled = !manual || cost === null || tr.unspent < cost;
        }
        const region = xpTarget();
        $('surplus').textContent = atCeiling(tr) ? `Surplus ${fmt(tr.surplus)} points` : `Surplus ${fmt(tr.surplus)} (every track at ${TRACK_MAX} first)`;
        const boost = $('boost');
        boost.textContent = region ? `→ region XP (${region})` : '→ region XP';
        boost.disabled = !(tr.surplus > 0) || !region;
        boost.title = region ? `Turn the surplus into ${region}'s XP` : 'Enter a Noiz2sa region first';
    }
    render();
    return { root, render };
}
