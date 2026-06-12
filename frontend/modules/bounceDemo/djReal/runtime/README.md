# SWFRecomp browser-WASM runtime (optional, gitignored)

The real-DJ renderer page (`../index.html`) auto-detects
`Doodle_Jump_loader.js` + `Doodle_Jump_loader.wasm` in this directory and
uses the SWFRecomp browser-WASM runtime (the production tier) instead of
the Ruffle CDN fallback. Force a tier with `?player=wasm` / `?player=ruffle`.

Build + copy (from `~/CC/SWFRecomp-CC`), against the SAME wide SWF that is
committed next to this directory as `../dj_loader.swf`:

```bash
cp ruffle-tests/tests/swfs/_swfbridge/livetest/dj_loader/dj_loader.swf \
   SWFRecomp/tests/flasharchive/Doodle_Jump_loader/test.swf
source emsdk/emsdk_env.sh
SWFRecomp/scripts/build_test.sh flasharchive/Doodle_Jump_loader wasm --graphics --clean
cp SWFRecomp/tests/flasharchive/Doodle_Jump_loader/build/wasm/Doodle_Jump_loader.{js,wasm} \
   ~/CC/Archipelago-CC/frontend/modules/bounceDemo/djReal/runtime/
```

Always `--clean`: build_test.sh does not re-run the recompiler when only
`test.swf` changed (stale-build gotcha, see SWFRecomp-CC's dj_loader README).
