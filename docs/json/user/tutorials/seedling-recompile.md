# Seedling: recompile the original game in your browser

*Seedling* is a Flash game. Flash is gone from browsers, so this project **recompiles** the game: SWFRecomp turns its SWF into C, and the C into WebAssembly, which any browser runs. The builds the app uses are prebuilt (see the [seedling-wasm README](https://github.com/PeerInfinity/seedling-wasm#readme)); this tutorial does the recompile itself, in the browser, with the same SWFRecomp commit that built them.

It starts with a **small** SWF, a one-frame test that draws four shapes and prints what it drew, so the whole pipeline takes about half a minute. Seedling itself is the optional last step: the same buttons, but minutes rather than seconds.

The compile runs **clang** in your browser. The first time, it downloads the compiler package (about 110 MB, from cdn.wasmer.io); the browser keeps it after that. It needs a recent Chrome or Edge with WebGPU.

## Recompile, compile, run

1. Open the **SWF Recompiler** tab (Quick Launch lists it). It loads the recompiler page and says whether it can compile **in the panel** (Chrome) or will use **a new tab** (other browsers).
2. Choose the example **avm2_graphics_runtime** in the **SWF** list.
3. Press **Recompile**: SWFRecomp, itself compiled to WebAssembly, turns the SWF into C. Where the panel cannot compile, this opens the recompiler in a new tab first — keep this tab in front.
4. Press **Compile**: clang turns the C into WebAssembly. Its progress shows in the **Compile** row (the first time, most of it is the compiler download).
5. Press **Run**: the movie starts — below the buttons, or in the recompiler tab. A red square, a cyan quad, a red-to-green gradient and a blue line.
6. Press **Check**: the panel compares what the movie printed (its **Trace**) with the example's expected output, and reads six pixels back from its canvas.

## Optional: all of Seedling

The same buttons recompile the whole game. Choose **A SWF file of your own…** and pick Seedling's SWF (build it from its AS3 source, [PeerInfinity/Seedling](https://github.com/PeerInfinity/Seedling), or use a copy of the original game you have), then Recompile, Compile and Run.

- It is big: on a fast desktop Chrome the recompile took about a minute and the compile about five; on a slow machine allow 20 minutes and 3 GB of memory.
- The result is the original game, title screen and all — the same game the prebuilt `seedling_original` build plays.
- The tutorial's own test does not take this step; it would run for about 18 minutes.

<!-- GENERATED from frontend/modules/tutorials/content/seedling/seedling.js by scripts/tutorials/generate-tutorial-docs.mjs — edit the tutorial, then run the generator; a hand edit here fails the pin. -->
