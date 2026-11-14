// Client half of the boot-sequence overlay.
//
// Rendering is a pure function of elapsed ms, so the sequence is frame-exact
// and cannot drift under load; one rAF loop advances a clock.
// Everything the module adds lives inside ctx.effect, so disabling the plugin
// removes the overlay, its timers and its stylesheet.
//
// tools/build-client.cjs substitutes the two placeholder tokens below; do not
// edit the generated client.js by hand.
window.__ModuleLoader__.load({
  id: '@local/dsh-boot-sequence',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    // ---- boot payload: log lines + traced whale mark ----
    const BOOT = __BOOT_DATA__;

    // ---- stylesheet: faces inlined as data: URLs + layout ----
    const FONT_CSS = __BOOT_CSS__;

    // Inject the sheet as a <style> tag. The client module system claims any
    // <style> a factory injects for this package and removes it when the
    // plugin unloads (claimStyles / removeOwnedStyles in dsh-client-modules).
    // This build exposes no `styles` builtin, so follow the shipped plugins.
    function insertStyles(css) {
      const tag = document.createElement('style');
      tag.setAttribute('data-plugin-css', '@local/dsh-boot-sequence/boot.css');
      tag.textContent = css;
      document.head.appendChild(tag);
      return () => { tag.remove(); };
    }


    // ---- timing: ported from eDEX-UI displayLine() / displayTitleScreen() ----
    const TITLE_FADE = 300;      // fadeInTitle duration
    const DEREZZER_MS = 50;      // derezzer_top / derezzer_bottom period
    const FADE_MS = 620;         // hand-off cross-fade to the workspace

    function buildTimeline(lines) {
      const lineAt = [];
      let t = 0;
      for (let i = 0; i < lines.length; i++) {
        const n = i + 1;
        lineAt.push(t);
        let d;
        if (n === 2) d = 500;
        else if (n === 4) d = 500;
        else if (n > 4 && n < 25) d = 30;
        else if (n === 25) d = 400;
        else if (n === 42) d = 300;
        else if (n > 42 && n < 82) d = 25;
        else d = Math.pow(1 - n / 1000, 3) * 25;
        t += d;
      }
      const T = { clear: t + 300 };
      T.title = T.clear + 400;
      T.solid = T.title + 200;
      T.band = T.solid + 100;
      T.frame = T.band + 300;
      T.glitch = T.frame + 100;
      T.calm = T.glitch + 500;
      T.remove = T.calm + 1000;
      T.end = T.remove + 700;
      return { lineAt, T };
    }

    const LAYOUT_CSS = `
      .dshboot {
        position: fixed; inset: 0; z-index: 2147483000;
        margin: 0; padding: 0; overflow: hidden;
        /* On Windows the caption buttons and the App/Edit bar are drawn by
           Electron's native titleBarOverlay OVER the page, in a strip along the
           top edge. Anything inside that strip is partially hidden, which is
           what cut the frame's top-right chamfer. Everything visual therefore
           starts below the strip instead of at y=0. */
        --chrome-inset: var(--dsh-windows-titlebar-height, 0px);
        --fg: #eef2f7;
        --fg-dim: #8d9aac;
        --ink-soft: rgba(238, 242, 247, .62);
        --surface: #05080d;
        --surface-hi: #0a1017;
        /* A slow phosphor vignette instead of a flat fill: the old version was
           a plain gradient, which read as "empty page" rather than "screen". */
        background:
          radial-gradient(72% 58% at 26% 34%, rgba(96, 150, 220, .075), transparent 70%),
          radial-gradient(120% 96% at 50% 52%, #0a1420 0%, #060b12 44%, #03060a 100%);
        background-size: auto, auto;
        color: var(--fg);
        user-select: none; cursor: default;
        transition: opacity 620ms cubic-bezier(.4, 0, .2, 1);
        will-change: opacity;
        isolation: isolate;
      }
      /* the three CRT layers: scanlines, a moving refresh band, and a vignette */
      .dshboot__crt,
      .dshboot__sweep,
      .dshboot__vig {
        position: absolute; inset: 0; pointer-events: none; z-index: 5;
      }
      .dshboot__crt {
        background: repeating-linear-gradient(
          to bottom,
          rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 2px,
          rgba(0, 0, 0, .30) 3px, rgba(0, 0, 0, .30) 4px);
        mix-blend-mode: multiply;
        opacity: .55;
      }
      .dshboot__sweep {
        height: 26vh; z-index: 2;
        inset: auto 0 auto 0;
        background: linear-gradient(
          to bottom,
          rgba(150, 210, 255, 0) 0%,
          rgba(150, 210, 255, .035) 42%,
          rgba(190, 235, 255, .085) 50%,
          rgba(150, 210, 255, .035) 58%,
          rgba(150, 210, 255, 0) 100%);
        animation: dshboot-sweep 6.2s linear infinite;
        opacity: .55;
        will-change: transform;
      }
      @keyframes dshboot-sweep {
        from { transform: translateY(-30vh); }
        to   { transform: translateY(105vh); }
      }
      .dshboot__vig {
        background: radial-gradient(118% 96% at 50% 50%, transparent 52%, rgba(0, 0, 0, .62) 100%);
        z-index: 6;
      }
      /* the hand-off to the workspace: fade instead of a hard cut */
      .dshboot[data-leaving="1"] { opacity: 0; }
      .dshboot__screen {
        position: absolute; inset: var(--chrome-inset) 0 0 0;
        display: flex; flex-direction: column;
        align-items: flex-start; justify-content: flex-end;
        font-family: "DSH Boot Mono", ui-monospace, "DejaVu Sans Mono", monospace;
        font-size: 1.22vh; line-height: 1.46;
        letter-spacing: .012em;
        text-align: left;
        white-space: pre-wrap; overflow: hidden;
        padding: 0 44vh 3.4vh 3vh;
        /* fade the oldest lines into the frame edge instead of cutting them */
        -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 22%);
        mask-image: linear-gradient(to bottom, transparent 0%, #000 22%);
        color: var(--fg);
        z-index: 3;
        /* a faint phosphor bloom so the text sits in the tube, not on it */
        text-shadow: 0 0 .9vh rgba(170, 205, 255, .18);
      }
      .dshboot__screen[data-center="1"] {
        align-items: center; justify-content: center;
        padding: 0; text-shadow: none;
      }
      .dshboot__ln { min-height: 1.32em; }
      /* the kernel banner is the one line that is prose, not machine noise */
      .dshboot__ln--banner {
        color: rgba(238, 242, 247, .92);
        letter-spacing: .006em;
      }
      /* Verbatim from eDEX src/assets/css/boot_screen.css: the title plate is a
         plain rectangle. It has NO chamfer 鈥?augmented-ui's bl-clip / tr-clip
         pair is used on the main shell panel, not on the boot screen. The
         frame choreography is: bottom border only -> full 5px box -> none
         (glitch) -> full box again. */
      .dshboot__title {
        --ring: 0.46vh;
        position: relative;
        font-family: "DSH Boot Display", "DSH Boot Mono", sans-serif;
        font-size: 10vh; text-align: center; line-height: 1;
        padding: 2vh 2vh 0 1.5vh;
        background-color: transparent;
        color: var(--fg);
        border-bottom: var(--ring) solid transparent;
        letter-spacing: .04em;
        text-shadow: 0 0 3.2vh rgba(150, 195, 255, .20);
      }
      .dshboot__title[data-band="1"] {
        background-color: var(--fg);
        color: var(--surface);
        border-bottom-color: var(--fg);
        text-shadow: none;
      }
      .dshboot__title[data-box="1"] {
        border: var(--ring) solid var(--fg);
        padding: calc(2vh - var(--ring)) calc(2vh - var(--ring)) 0 calc(1.5vh - var(--ring));
      }
      .dshboot__title[data-glitch="1"] {
        background-color: transparent;
        border: none;
        color: transparent;
        text-shadow: none;
      }
      .dshboot__title[data-glitch="1"]::before,
      .dshboot__title[data-glitch="1"]::after {
        content: attr(data-text);
        position: absolute; left: 0; right: 0; top: 2vh;
        padding: inherit; pointer-events: none; display: block;
      }
      .dshboot__title[data-glitch="1"]::before {
        clip-path: polygon(100% 0%, 100% 40%, 0% 40%, 0% 0%);
        color: rgba(238, 242, 247, 0.8);
        transform: translateX(var(--dz-top, -1%));
      }
      .dshboot__title[data-glitch="1"]::after {
        clip-path: polygon(100% 40%, 100% 100%, 0% 100%, 0% 40%);
        color: rgba(238, 242, 247, 0.9);
        transform: translateX(var(--dz-bottom, 1%));
      }
      /* ---- the mascot: line art sitting IN the scene, not pasted on it ----
         Three stacked pieces: a soft radial bed so the paper edges dissolve,
         the art itself, and a mask that feathers the rectangle away on all
         four sides. Without this the drawing read as a sticker. */
      .dshboot__mascot-bed,
      .dshboot__mascot-wrap {
        position: absolute;
        right: 0; bottom: 2.2vh;
        width: 44vh; height: 72vh;
        pointer-events: none;
      }
      .dshboot__mascot-bed {
        background:
          radial-gradient(58% 46% at 62% 52%, rgba(92, 146, 214, .16), transparent 72%),
          radial-gradient(70% 60% at 70% 78%, rgba(60, 100, 170, .10), transparent 76%);
        filter: blur(1.2vh);
        z-index: 1;
      }
      .dshboot__mascot-wrap { z-index: 2; overflow: visible; }
      .dshboot__mascot {
        position: absolute;
        right: 1.6vh; bottom: 2.2vh;
        height: 66vh;
        width: auto;
        max-width: 42vh;
        object-fit: contain;
        object-position: bottom right;
        pointer-events: none;
        /* monochrome ink at reduced weight, plus the feather mask */
        opacity: .78;
        filter:
          brightness(1.55)
          drop-shadow(0 0 1.6vh rgba(120, 170, 235, .30))
          drop-shadow(0 0 5vh rgba(70, 120, 200, .12));
        -webkit-mask-image:
          linear-gradient(to bottom, transparent 0%, #000 9%, #000 88%, transparent 100%),
          linear-gradient(to right, transparent 0%, #000 7%, #000 100%);
        mask-image:
          linear-gradient(to bottom, transparent 0%, #000 9%, #000 88%, transparent 100%),
          linear-gradient(to right, transparent 0%, #000 7%, #000 100%);
        -webkit-mask-composite: source-in;
        mask-composite: intersect;
      }
      .dshboot__skip {
        position: absolute; right: 2.2vh; bottom: 1.8vh;
        font-family: "DSH Boot Mono", monospace; font-size: 1.1vh;
        letter-spacing: .14em; text-transform: uppercase;
        color: var(--fg-dim); opacity: .42;
        pointer-events: none;
        z-index: 7;
      }
      /* the blinking block cursor the log ends with */
      .dshboot__caret {
        display: inline-block;
        width: .62vh; height: 1.28vh;
        margin-left: .5vh; vertical-align: -.18vh;
        background: var(--fg);
        opacity: .85;
        animation: dshboot-blink 1.06s steps(1, end) infinite;
      }
      @keyframes dshboot-blink { 0%, 55% { opacity: .85; } 56%, 100% { opacity: 0; } }
      /* Outer screen frame. eDEX's augmented-ui "bl-clip tr-clip" cuts exactly
         two opposite corners; the other two stay square. Note the chamfer is
         measured from each corner's own edges: the top slice runs fb in from
         the LEFT edge for the top-right cut, and the bottom slice runs fb in
         from the RIGHT edge for the bottom-left cut. */
      .dshboot__frame {
        position: absolute;
        inset: calc(var(--chrome-inset) + 1.6vh) 1.6vh 1.6vh 1.6vh;
        --fb: 3.2vh;
        --fr: 0.12vh;
        border: var(--fr) solid rgba(238, 242, 247, .26);
        pointer-events: none;
        z-index: 4;
        clip-path: polygon(
          0 0,
          calc(100% - var(--fb)) 0,
          100% var(--fb),
          100% 100%,
          var(--fb) 100%,
          0 calc(100% - var(--fb)));
      }
      /* corner ticks: four short strokes that make the plate read as a HUD */
      .dshboot__tick {
        position: absolute; width: 2.6vh; height: 2.6vh;
        pointer-events: none; z-index: 4;
        border-color: rgba(238, 242, 247, .55);
        border-style: solid; border-width: 0;
      }
      .dshboot__tick--tl { top: calc(var(--chrome-inset) + 1.6vh); left: 1.6vh;
        border-top-width: .16vh; border-left-width: .16vh; }
      .dshboot__tick--br { bottom: 1.6vh; right: 1.6vh;
        border-bottom-width: .16vh; border-right-width: .16vh; }
      @media (prefers-reduced-motion: reduce) {
        .dshboot__title[data-glitch="1"]::before,
        .dshboot__title[data-glitch="1"]::after { transform: none; }
        .dshboot { transition-duration: 1ms; }
        .dshboot__sweep, .dshboot__caret { animation: none; }
      }
      /* The Windows caption buttons and the App/Edit menu are NOT in this
         document: they come from Electron's native titleBarOverlay and from a
         preload-injected shadow-DOM bar. No z-index can cover them. The preload
         reads two theme tokens with a hidden probe and pushes them to the
         native overlay, so overriding those two tokens during boot is how the
         chrome blends in. The tokens are declared on body by the theme sheet,
         so this rule must outrank them: html.<class> beats body, and
         !important removes any doubt about specificity in either theme. */
      html.dshboot-active {
        --dsw-specific-sidebar-fill: #05080d !important;
        --dsw-alias-label-primary: #05080d !important;
      }
      html.dshboot-active [data-windows-menu] { opacity: 0 !important; }
    `;

    // ---- sound: eDEX-UI's own cues, inlined ---------------------------
    // The plugin asset route only serves images (svg/png/webp/jpg), so the wav
    // files are base64'd into the bundle at build time instead of fetched.
    const AUDIO = __BOOT_AUDIO__;

    function createAudio() {
      const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
      if (!AC) return null;
      let ac;
      try { ac = new AC(); } catch { return null; }

      const buffers = Object.create(null);
      // data: URLs decode synchronously from base64 鈥?no fetch, so a strict CSP
      // or a strict-mime policy cannot stop the cues.
      const load = (key, dataUrl) => {
        if (typeof dataUrl !== 'string') return;
        const comma = dataUrl.indexOf(',');
        if (comma < 0) return;
        try {
          const bin = atob(dataUrl.slice(comma + 1));
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const promise = ac.decodeAudioData
            ? new Promise((resolve, reject) => ac.decodeAudioData(bytes.buffer.slice(0), resolve, reject))
            : ac.decodeAudioData(bytes.buffer.slice(0));
          Promise.resolve(promise)
            .then(decoded => { buffers[key] = decoded; })
            .catch(() => {});
        } catch {}
      };
      for (const k of Object.keys(AUDIO)) load(k, AUDIO[k]);

      const resume = () => { if (ac.state === 'suspended') ac.resume().catch(() => {}); };

      // eDEX plays audioManager.stdout per line and .granted on "Boot Complete"
      const play = (key, gain) => {
        const buffer = buffers[key];
        if (!buffer) return;      // not decoded yet: drop it, never stall
        try {
          const src = ac.createBufferSource();
          src.buffer = buffer;
          const g = ac.createGain();
          g.gain.value = gain;
          src.connect(g).connect(ac.destination);
          src.start();
        } catch {}
      };

      return {
        resume,
        line: () => { resume(); play('stdout', 0.5); },
        complete: () => { resume(); play('granted', 0.6); },
        theme: () => { resume(); play('theme', 0.45); },
        dispose: () => { try { ac.close(); } catch {} },
      };
    }

    // ---- whale-girl mascot (CC BY-NC-SA 4.0, see CREDITS.md) -----------
    // The asset route is /plugins/<package>/assets/<rest>, and the host
    // resolves "<package>/assets/<rest>" through Node 鈥?so the file must live
    // in the package's own assets/ directory and be matched by an export.
    // The image is a monochrome line drawing traced from the mature character
    // sheet, so it carries no hue of its own.
    const MASCOT_URL = '/plugins/@local/dsh-boot-sequence/assets/mascot/whalegirl.webp';

    function BootOverlay() {
      const [t, setT] = React.useState(0);
      const [gone, setGone] = React.useState(false);

      const model = React.useMemo(() => {
        const { lineAt, T } = buildTimeline(BOOT.lines);
        const banner =
          'the agent runtime Kernel version ' + BOOT.version +
          ' boot at ' + new Date().toString() +
          '; root:xnu-1699.22.73~1/RELEASE_X86_64';
        return { lineAt, T, banner };
      }, []);

      // ---- the hand-off: fade the overlay out instead of cutting ----------
      const [leaving, setLeaving] = React.useState(false);

      React.useEffect(() => {
        if (gone) return undefined;
        let raf = 0;
        const t0 = performance.now();
        const step = () => {
          const dt = performance.now() - t0;
          setT(dt);
          if (dt < model.T.end) raf = requestAnimationFrame(step);
          else setGone(true);
        };
        raf = requestAnimationFrame(step);

        // Esc or a click ends the intro early 鈥?but still through the fade,
        // so skipping never hard-cuts into the workspace.
        const skip = () => setLeaving(true);
        window.addEventListener('keydown', skip);
        window.addEventListener('pointerdown', skip);
        return () => {
          cancelAnimationFrame(raf);
          window.removeEventListener('keydown', skip);
          window.removeEventListener('pointerdown', skip);
        };
      }, [gone, model]);

      // ---- sound cues, keyed to the same timeline as the visuals ----
      const audioRef = React.useRef(null);
      const firedRef = React.useRef({});
      React.useEffect(() => {
        if (gone) return undefined;
        const audio = createAudio();
        audioRef.current = audio;
        // a gesture anywhere unlocks the context if it started suspended
        const wake = () => audioRef.current?.resume();
        window.addEventListener('pointerdown', wake);
        window.addEventListener('keydown', wake);
        return () => {
          window.removeEventListener('pointerdown', wake);
          window.removeEventListener('keydown', wake);
          audio?.dispose();
          audioRef.current = null;
        };
      }, [gone]);

      React.useEffect(() => {
        const audio = audioRef.current;
        if (gone || !audio) return;
        const fired = firedRef.current;

        // one blip per printed log line
        for (let i = 0; i < model.lineAt.length; i++) {
          if (t >= model.lineAt[i] && !fired['l' + i]) {
            fired['l' + i] = true;
            if (BOOT.lines[i] === 'Boot Complete') audio.complete();
            else audio.line(i);
          }
        }
        // the theme swell lands with the title screen
        if (t >= model.T.title && !fired.theme) { fired.theme = true; audio.theme(); }
      });

      // ---- once fading, unmount after the transition ----------------------
      React.useEffect(() => {
        if (!leaving) return undefined;
        const id = setTimeout(() => setGone(true), FADE_MS);
        return () => clearTimeout(id);
      }, [leaving]);

      // ---- hide the native caption chrome for the duration ---------------
      // The App/Edit bar and the window buttons live outside this document
      // (preload shadow DOM + Electron titleBarOverlay), so they are hidden by
      // overriding the tokens the preload mirrors, not by z-index.
      React.useEffect(() => {
        if (gone) return undefined;
        const root = document.documentElement;
        root.classList.add('dshboot-active');
        return () => { root.classList.remove('dshboot-active'); };
      }, [gone]);

      React.useEffect(() => {
        if (t < model.T.remove) return;
        setLeaving(true);
      }, [t, model]);

      if (gone) return null;

      const { lineAt, T, banner } = model;
      let body;

      if (t < T.clear) {
        let n = 0;
        for (let i = 0; i < lineAt.length; i++) if (t >= lineAt[i]) n = i + 1;

        // One element per line so interesting lines can carry weight: the kernel
        // banner reads as a headline and blank spacer lines stay blank.
        const rows = [];
        for (let i = 0; i < n; i++) {
          rows.push(h('div', { key: 'l' + i, className: 'dshboot__ln' }, BOOT.lines[i]));
          if (i === 1) {
            rows.push(h('div', { key: 'b', className: 'dshboot__ln dshboot__ln--banner' }, banner));
          }
        }
        // the caret sits at the live edge only while output is still flowing
        const live = t < lineAt[lineAt.length - 1];
        rows.push(h('div', { key: 'cur', className: 'dshboot__ln' },
          live ? h('span', { className: 'dshboot__caret' }) : null));

        body = h('div', { className: 'dshboot__screen', 'data-center': '0' }, rows);
      } else {
        const opacity = Math.min(1, Math.max(0, (t - T.title) / TITLE_FADE));
        const glitching = t >= T.glitch && t < T.calm;
        const band = t >= T.band && t < T.frame;
        const box = (t >= T.frame && t < T.glitch) || t >= T.calm;
        let dzTop = -1, dzBottom = 1;
        if (glitching) {
          const ph = ((t - T.glitch) / DEREZZER_MS) % 2;
          const k = ph < 1 ? 1 - ph : ph - 1;
          dzTop = -1 - 4 * k;
          dzBottom = 1 + 2 * k;
        }
        body = h('div', { className: 'dshboot__screen', 'data-center': '1' },
          t >= T.title
            ? h('div', {
                className: 'dshboot__title',
                'data-text': BOOT.title,
                'data-glitch': glitching ? '1' : '0',
                'data-band': band ? '1' : '0',
                'data-box': box ? '1' : '0',
                style: { opacity, '--dz-top': dzTop + '%', '--dz-bottom': dzBottom + '%' },
              }, BOOT.title)
            : null);
      }

      // the mascot stays for the whole sequence and leaves with the fade,
      // not with the glitch, so she is still there when the logo lands
      const inA = Math.min(1, Math.max(0, (t - 350) / 900));
      const outA = Math.min(1, Math.max(0, (t - T.remove) / 500));

      return h('div', {
        className: 'dshboot',
        // drives the cross-fade out into the workspace
        'data-leaving': leaving ? '1' : '0',
        'aria-hidden': leaving ? 'true' : undefined,
      },
        // the mascot bed must sit under the art, so it comes first
        inA > 0 && outA < 1
          ? h('div', {
              className: 'dshboot__mascot-bed',
              'aria-hidden': true,
              style: { opacity: (inA * (1 - outA) * 0.9).toFixed(3) },
            })
          : null,
        inA > 0 && outA < 1
          ? h('div', {
              className: 'dshboot__mascot-wrap',
              'aria-hidden': true,
              style: { opacity: (inA * (1 - outA)).toFixed(3) },
            },
            h('img', {
              className: 'dshboot__mascot',
              src: MASCOT_URL,
              alt: '',
              // small rise on entry; no centring offset (it is corner-anchored)
              style: { transform: `translateY(${((1 - inA) * 1.4).toFixed(2)}vh)` },
              onError: e => { e.currentTarget.style.display = 'none'; },
            }))
          : null,
        body,
        h('div', { className: 'dshboot__frame', 'aria-hidden': true }),
        h('div', { className: 'dshboot__tick dshboot__tick--tl', 'aria-hidden': true }),
        h('div', { className: 'dshboot__tick dshboot__tick--br', 'aria-hidden': true }),
        // CRT stack: scanlines under the vignette, the refresh band on top
        h('div', { className: 'dshboot__crt', 'aria-hidden': true }),
        h('div', { className: 'dshboot__sweep', 'aria-hidden': true }),
        h('div', { className: 'dshboot__vig', 'aria-hidden': true }),
        h('div', { className: 'dshboot__skip' }, 'esc to skip'));
    }

    return {
      // `slots` is a hard dependency: without it ctx.slots is undefined and
      // apply() throws, which shows up only as a missing slot occupant.
      inject: ['slots'],
      apply(ctx) {
        ctx.effect(() => insertStyles(FONT_CSS + LAYOUT_CSS), 'boot sequence stylesheet');
        ctx.effect(
          () => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
            name: 'shell.overlay',
            id: 'dsh-boot-sequence',
            // negative order: first in the overlay list, so the splash sits on
            // top of the toasts the host registers at order 0
            order: -1000,
            label: 'Boot sequence',
          }, BootOverlay)),
          'boot sequence overlay',
        );
      },
    };
  },
});
