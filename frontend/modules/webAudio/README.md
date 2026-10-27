# webAudio

**One audio output for a page:** the `AudioContext`, the unlock, the decode and the master volume. Generic: it knows
browsers, never a game. The sound-effect library plays through it, and the music library is meant to share it.

- `createAudioOut({ win, AudioContextCtor, listen })` → `unlock()` (call it inside a tap or click), `decode()`,
  `play(buffer, { when, gain, pan })`, `hold(on)`, `setVolume(0..1)`, `setMuted()`, `now()`, `state`.
- ⛔ **Nothing before the unlock:** no context exists and `play` returns null until `unlock()` runs in a gesture.
- **Mobile:**
  - iOS's ring/silent switch mutes Web Audio by default. `unlock` sets `navigator.audioSession.type = 'playback'`
    (Safari 16.4+), or on older iOS plays a looping, silent `<audio>` element, which moves the page's audio session
    to "playback".
  - A 1-sample silent buffer is started in the gesture (older iOS).
  - The context is suspended while the tab is hidden or `hold(true)` is set. It resumes on the next visibility
    change or tap (iOS `interrupted` included).
- ⛔ **A refused context** (no Web Audio, a throwing constructor) gives `state: 'refused'`. Every call is then a
  quiet no-op, and the page plays on in silence.
