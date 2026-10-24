# SWF Recompiler

The SWF Recompiler panel recompiles a Flash movie (a `.swf` file) into a WebAssembly program, in your browser, and runs it. It is [SWFRecomp](https://github.com/PeerInfinity/SWFRecomp-CC)'s in-browser recompiler: the page the panel drives is the [swfrecomp-browser](https://github.com/PeerInfinity/swfrecomp-browser) release, built from the same SWFRecomp commit as the prebuilt Seedling builds the app plays. The tutorial *Seedling: recompile the original game in your browser* walks through it.

## Using it

1. **SWF** — choose an example the recompiler ships, or **A SWF file of your own…** and pick the file.
2. **Recompile** — SWFRecomp, itself compiled to WebAssembly, turns the SWF into C.
3. **Compile** — clang, running in your browser, turns the C into WebAssembly. The first time it downloads the compiler package (about 110 MB, from cdn.wasmer.io, checked against its SHA-256); the browser keeps it after that.
4. **Run** — the movie starts.
5. **Check** — for an example, compares what the movie printed (the **Trace**) with the example's expected output and reads a few pixels back from its canvas. For your own SWF it shows what the movie printed.

Each stage's row shows its progress, its time and any error. The graphics runtime runs one SWF per page load, so a second **Recompile** reloads the recompiler page first.

## In the panel, or in a new tab

Compiling needs the page to be *cross-origin isolated*. The panel asks the page what it can do and says which route it takes:

- **In the panel** — Chrome (and other Chromium browsers that honour `Document-Isolation-Policy`) isolate the panel's frame, so everything runs there and the movie appears in the panel.
- **In a new tab** — elsewhere, **Recompile** opens the recompiler in a tab of its own and the panel drives it from here; the movie runs in that tab. Allow pop-ups for the site if the browser blocks the tab. **Open in a new tab** takes this route on any browser.

Running a movie needs WebGPU and WebAssembly JSPI (Chrome or Edge 137 or later).

## Notes

- With no network, **Recompile** still works; **Compile** stops at once with an error naming the compiler package's URL.
- On a successful compile, the browser console shows one or two `panicked at …` / `RuntimeError: unreachable` lines from the Wasmer SDK. They are harmless.
- A large game takes much longer: all of Seedling takes minutes to recompile and many minutes to compile, and needs about 3 GB of memory.
