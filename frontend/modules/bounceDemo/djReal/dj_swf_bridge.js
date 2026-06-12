// dj_swf_bridge.js — the recompiled-DJ page's game side of the flashSubstrate
// `window.__swfBridge` contract (configure/pollItems in; sendLocation/sendExit
// out — same semantics as the JS renderer reference implementation,
// Archipelago-CC/frontend/modules/bounceDemo/game/main.js).
//
// The injected Loader.as pulls through ExternalInterface (works under BOTH
// Ruffle and SWFRecomp WASM — load this file before the player on either page):
//   __swfConfig()           -> compact level string ('' until configure() ran)
//   __swfPoll()             -> FULL current held-item set, comma-separated
//   __swfSendLocation(id)   -> __swfBridge.sendLocation(id)
//   __swfSendExit('id|side')-> __swfBridge.sendExit(id, side)
//     (single packed arg: the recompiled EI marshaler is 1-string-arg/1-return)
//
// encodeLevel MUST stay in sync with gen_fixture.py::encode_level (same record
// format, coordinate mapping, bottom-to-top index assignment).

(function () {
	'use strict';

	// Stage geometry: with the stock 240px stage we render the center 240px
	// strip of the 600px world; pages serving the header-patched wide build
	// (inject_tracer.py --stage-width 600) set window.__DJ_STAGE_W = 600 for
	// 1:1 x mapping. Level bottom always aligns with stage bottom.
	const STAGE_W = Number(window.__DJ_STAGE_W || 240), STAGE_H = 400;
	const GATE_ITEM = { blue: 'Blue platforms', brown: 'Brown platforms' };
	const TYPE_CODE = { green: 'g', brown: 'b', blue: 'm' };

	let pendingCfg = '';
	let heldItems = [];

	function encodeLevel(config) {
		const params = (config && config.params) || {};
		const lvl = params.bounceLevel;
		if (!lvl) {
			console.warn('[dj-bridge] configure without params.bounceLevel', config);
			return '';
		}
		// On this page the physics constants are inherently the real DJ's —
		// refuse anything else loudly (spec: assert profile === 'dj').
		const profile = params.physics && params.physics.profile;
		if (profile !== 'dj') {
			console.error("[dj-bridge] REFUSING level: physics profile '" + profile
				+ "' is not 'dj' — this page runs the real DJ engine");
			return '';
		}
		const W = lvl.size.width, H = lvl.size.height;
		const xOff = (W - STAGE_W) / 2, yOff = H - STAGE_H;

		const goals = {};
		for (const pk of lvl.pickups || []) goals[pk.on] = { kind: 'loc', id: pk.id, side: '' };
		const portalSide = {};
		for (const [side, pid] of Object.entries(params.sidePortals || {})) portalSide[pid] = side;
		for (const pt of lvl.portals || []) {
			goals[pt.on] = { kind: 'exit', id: pt.id, side: portalSide[pt.id] || '' };
		}

		const recs = [['R', lvl.id, W, H, W / 2 - xOff, H - 120 - yOff].join('|')];
		// Bottom-to-top index order: the hero's catch loop scans block indices
		// around lastblockhit (see Loader.as).
		const plats = [...lvl.platforms].sort((a, b) => b.y - a.y);
		plats.forEach((p, i) => {
			const g = goals[p.id] || { kind: '', id: '', side: '' };
			recs.push(['P', i, p.id, TYPE_CODE[p.type] || 'g', p.x - xOff, p.y - yOff,
				GATE_ITEM[p.type] || '', g.kind, g.id, g.side].join('|'));
		});
		const checkedIds = config.checkedLocations || [];
		if (checkedIds.length) recs.push('C|' + checkedIds.join(','));
		return recs.join(';');
	}

	// Game side of the contract (the host bridge injects sendLocation/sendExit).
	window.__swfBridge = Object.assign(window.__swfBridge || {}, {
		configure(config) {
			pendingCfg = encodeLevel(config);
			console.log('[dj-bridge] configure(' + ((config && config.regionId) || '?')
				+ ') -> ' + (pendingCfg ? pendingCfg.length + ' chars' : 'REFUSED'));
		},
		pollItems(received) {
			heldItems = Array.isArray(received) ? received.slice() : [];
		},
	});

	// EI surface the injected loader calls (window-level, per the proven
	// SWFRecomp swf_browser_external_call + Ruffle ExternalInterface paths).
	window.__swfConfig = function () { return pendingCfg; };
	window.__swfPoll = function () { return heldItems.join(','); };
	window.__swfSendLocation = function (id) {
		console.log('[dj-bridge] sendLocation(' + id + ')');
		if (window.__swfBridge.sendLocation) window.__swfBridge.sendLocation(String(id));
		return '';
	};
	window.__swfSendExit = function (packed) {
		const s = String(packed);
		const i = s.indexOf('|');
		const id = i < 0 ? s : s.slice(0, i);
		const side = i < 0 ? null : s.slice(i + 1);
		console.log('[dj-bridge] sendExit(' + id + ', ' + side + ')');
		if (window.__swfBridge.sendExit) window.__swfBridge.sendExit(id, side);
		return '';
	};
})();
