// swf_inject.mjs — canonical browser-usable SWF injector (ES module).
//
// The JS counterpart of inject_tracer.py for the loader-injection pipeline:
// splice pre-extracted AVM1 bytecode (DoAction/DoInitAction/DefineSprite/
// ExportAssets tag bytes, e.g. dj_loader's loader_bytecode.bin) into a target
// SWF before its first ShowFrame, optionally widening the header FrameSize
// RECT (Stage.width-driven games like Doodle Jump then adopt the new
// playfield width with zero bytecode changes).
//
// This module is OWNED here so patch logic and the injected loader evolve
// together; embedding hosts (Archipelago-CC djReal/swfPatch.js) vendor it
// verbatim and pin byte-identity against inject_tracer.py
// (test: tools/divergence/test_swf_inject.mjs).
//
// Scope (deliberate subset of inject_tracer.py): FWS + CWS (zlib) input,
// SWF version >= 6 targets. LZMA (ZWS) and the SWF5 CLIPACTIONS UI16->UI32
// widening are NOT ported — the python tool remains the reference for those;
// this module throws rather than emit a silently-wrong file.
//
//   import { injectSwf } from './swf_inject.mjs';
//   const out = await injectSwf(originalSwfBytes, bytecodeBytes,
//                               { stageWidth: 600, minVersion: 8 });
//   // -> Uint8Array, uncompressed FWS
//
// Works in browsers (DecompressionStream) and Node >= 18 (node:zlib fallback).

async function inflateZlib(bytes) {
	if (typeof DecompressionStream === 'function') {
		const ds = new DecompressionStream('deflate');
		const stream = new Blob([bytes]).stream().pipeThrough(ds);
		const buf = await new Response(stream).arrayBuffer();
		return new Uint8Array(buf);
	}
	const zlib = await import('node:zlib');
	return new Uint8Array(zlib.inflateSync(bytes));
}

async function decompressSwf(bytes) {
	const sig = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
	if (sig === 'FWS') return bytes.slice();
	if (sig === 'CWS') {
		const body = await inflateZlib(bytes.subarray(8));
		const out = new Uint8Array(8 + body.length);
		out.set(bytes.subarray(0, 8));
		out[0] = 0x46; // 'F'
		out.set(body, 8);
		return out;
	}
	if (sig === 'ZWS') throw new Error('LZMA (ZWS) SWFs not supported by swf_inject.mjs — use inject_tracer.py');
	throw new Error('Not a SWF: signature ' + JSON.stringify(sig));
}

function rectNbits(fws) {
	return (fws[8] >> 3) & 0x1f;
}

function rectByteLen(nbits) {
	return Math.ceil((5 + 4 * nbits) / 8);
}

function readSb(fws, bitpos, n) {
	let v = 0;
	for (let i = 0; i < n; i++) {
		const p = bitpos + i;
		v = (v << 1) | ((fws[8 + (p >> 3)] >> (7 - (p & 7))) & 1);
	}
	if (n > 0 && v & (1 << (n - 1))) v -= 1 << n;
	return v;
}

// Re-pack the header FrameSize RECT with xmax = widthPx (signed bitfields
// share one nbits, so the RECT may grow; the tail is shifted accordingly).
// Mirrors inject_tracer.py::patch_stage_width bit-for-bit.
function patchStageWidth(fws, widthPx) {
	const newXmax = widthPx * 20; // px -> twips
	const nbits = rectNbits(fws);
	const xmin = readSb(fws, 5, nbits);
	const ymin = readSb(fws, 5 + 2 * nbits, nbits);
	const ymax = readSb(fws, 5 + 3 * nbits, nbits);
	const oldLen = rectByteLen(nbits);

	const vals = [xmin, newXmax, ymin, ymax];
	let newNbits = 0;
	for (const v of vals) {
		const need = (v < 0 ? Math.abs(v + 1) : v).toString(2).length + 1; // sign bit
		if (need > newNbits) newNbits = need;
	}
	const bits = [];
	for (let i = 0; i < 5; i++) bits.push((newNbits >> (4 - i)) & 1);
	for (const v of vals) {
		const u = v < 0 ? (1 << newNbits) + v : v;
		for (let i = 0; i < newNbits; i++) bits.push((u >> (newNbits - 1 - i)) & 1);
	}
	while (bits.length % 8) bits.push(0);
	const rect = new Uint8Array(bits.length / 8);
	bits.forEach((bit, i) => { if (bit) rect[i >> 3] |= 1 << (7 - (i & 7)); });

	const out = new Uint8Array(fws.length - oldLen + rect.length);
	out.set(fws.subarray(0, 8));
	out.set(rect, 8);
	out.set(fws.subarray(8 + oldLen), 8 + rect.length);
	return out;
}

// Byte offset of the first ShowFrame tag header (the splice point).
function findFirstShowframe(fws) {
	let pos = 8 + rectByteLen(rectNbits(fws)) + 4; // header + RECT + rate/count
	const dv = new DataView(fws.buffer, fws.byteOffset, fws.byteLength);
	while (pos + 2 <= fws.length) {
		const tagStart = pos;
		const cl = dv.getUint16(pos, true);
		pos += 2;
		const type = (cl >> 6) & 0x3ff;
		let len = cl & 0x3f;
		if (len === 0x3f) {
			len = dv.getUint32(pos, true);
			pos += 4;
		}
		if (type === 1 || type === 0) return tagStart; // ShowFrame / End
		pos += len;
	}
	return -1;
}

/**
 * Splice loader bytecode into a SWF before its first ShowFrame.
 *
 * @param {Uint8Array} swfBytes      original SWF (FWS or CWS)
 * @param {Uint8Array} bytecodeBytes pre-extracted tag bytes (extract_bytecode.py)
 * @param {{stageWidth?: number, minVersion?: number}} [opts]
 *        stageWidth: re-pack the header RECT to this many px wide (0/absent =
 *        leave unchanged); minVersion: bump the SWF version to at least this
 *        (default 8; the original must already be >= 6).
 * @returns {Promise<Uint8Array>} uncompressed FWS bytes
 */
export async function injectSwf(swfBytes, bytecodeBytes, opts = {}) {
	const { stageWidth = 0, minVersion = 8 } = opts;
	let fws = await decompressSwf(swfBytes);

	if (fws[3] < 6 && minVersion >= 6) {
		throw new Error('SWF version ' + fws[3] + ' < 6: the CLIPACTIONS '
			+ 'UI16->UI32 widening is not ported — use inject_tracer.py');
	}
	if (stageWidth) fws = patchStageWidth(fws, stageWidth);

	const insertPos = findFirstShowframe(fws);
	if (insertPos < 0) throw new Error('No ShowFrame tag found');

	if (fws[3] < minVersion) fws[3] = minVersion;

	const out = new Uint8Array(fws.length + bytecodeBytes.length);
	out.set(fws.subarray(0, insertPos));
	out.set(bytecodeBytes, insertPos);
	out.set(fws.subarray(insertPos), insertPos + bytecodeBytes.length);

	// File length, bytes 4-7 LE.
	new DataView(out.buffer).setUint32(4, out.length, true);
	return out;
}
