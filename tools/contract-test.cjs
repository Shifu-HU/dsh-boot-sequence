// End-to-end simulation of the web boot for this plugin, without the Harness:
//  - evaluate client.js against a stub __ModuleLoader__ (React stub + ctx stub)
//  - assert apply() registers into shell.overlay and inserts one stylesheet
//  - render the component for several timestamps and record what it produces
//
// This is a contract test, not a visual preview: it catches the failure class
// that broke startup (module loads but apply throws).
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8');

// ---- minimal React that records element trees -------------------------
function createElement(type, props, ...children) {
  return { type, props: props || {}, children: children.flat() };
}
const hooks = { states: [], cursor: 0 };
const React = {
  createElement,
  useState(init) {
    const i = hooks.cursor++;
    if (!(i in hooks.states)) hooks.states[i] = typeof init === 'function' ? init() : init;
    return [hooks.states[i], v => { hooks.states[i] = typeof v === 'function' ? v(hooks.states[i]) : v; }];
  },
  useMemo(fn) { return fn(); },
  useEffect() { return undefined; },
  useRef(v) { return { current: v }; },
};
function resetHooks() { hooks.states = []; hooks.cursor = 0; }

// ---- capture the module contract --------------------------------------
let loaded = null;
const registered = [];
const injected = [];

// `ctx`, `React`, `host` are builtins injected into the factory scope by
// __ModuleLoader__. `document` is the real page document in the browser, so
// the module injects its <style> tag itself (no `styles` builtin exists in
// this build — verified against dsh-client-modules and shipped plugins).
const stylesheets = [];
const styleTags = [];
const fakeDoc = {
  head: {
    appendChild(node) { styleTags.push(node); stylesheets.push(node.textContent); return node; },
  },
  createElement(tagName) {
    if (tagName !== 'style') throw new Error('unexpected createElement: ' + tagName);
    const attrs = {};
    return {
      tagName, textContent: '',
      setAttribute(k, v) { attrs[k] = v; },
      getAttribute(k) { return attrs[k]; },
      remove() {
        const i = styleTags.indexOf(this);
        if (i >= 0) { styleTags.splice(i, 1); stylesheets.splice(i, 1); }
      },
      attrs,
    };
  },
};

const window = {
  __ModuleLoader__: { load: m => { loaded = m; } },
  addEventListener() {}, removeEventListener() {},
};
const sandbox = {
  window,
  document: fakeDoc,
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  console,
  Math, Date, JSON, Array, Object, String, Number, Boolean, Error, isNaN, parseInt, parseFloat,
};
sandbox.globalThis = sandbox;

vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: 'client.js' });

const fail = m => { console.error('FAIL: ' + m); process.exitCode = 1; };
const ok = m => console.log('ok   ' + m);

if (loaded === null) { fail('__ModuleLoader__.load was not called'); process.exit(1); }
else ok('module registered as ' + loaded.id);

// the factory must be pure: no side effects at factory time
const before = { sheets: stylesheets.length, regs: registered.length };
const assets = [];
const requireStub = spec => {
  if (spec === 'react') return React;
  throw new Error('unexpected require: ' + spec);
};
// the client module system exposes require.asset(reference) for package assets
requireStub.asset = ref => { assets.push(ref); return 'asset://' + ref; };
const mod = loaded.factory(requireStub);
if (stylesheets.length !== before.sheets || registered.length !== before.regs) {
  fail('factory() had side effects');
} else ok('factory() is side-effect free');

if (!Array.isArray(mod.inject) || !mod.inject.includes('slots')) fail("client does not inject 'slots'");
else ok("inject: ['slots']");

// ---- ctx stub ----------------------------------------------------------
const disposers = [];
const ctx = {
  effect(fn, label) { const d = fn(); disposers.push({ label, d }); return d || (() => {}); },
  slots: {
    inject(slotName, cb) { injected.push(slotName); return cb(); },
    register(options, component) { registered.push({ options, component }); return () => {}; },
  },
};

try {
  mod.apply(ctx);
  ok('apply() did not throw');
} catch (e) {
  fail('apply() threw: ' + e.message);
  process.exit(1);
}

if (!injected.includes('shell.overlay')) fail('did not inject shell.overlay');
else ok('injected into shell.overlay');
if (registered.length !== 1) fail('expected 1 registration, got ' + registered.length);
else ok('registered id=' + registered[0].options.id + ' order=' + registered[0].options.order);
if (stylesheets.length !== 1) fail('expected 1 stylesheet, got ' + stylesheets.length);
else ok('inserted stylesheet (' + (stylesheets[0].length / 1024).toFixed(1) + ' KiB)');
if (disposers.length !== 2) fail('expected 2 effects, got ' + disposers.length);
else ok('2 effects registered for cleanup');

// ---- render at sample timestamps ---------------------------------------
const css = stylesheets[0];
if (!css.includes('@font-face')) fail('stylesheet has no @font-face');
else ok('stylesheet carries the inlined faces');

const C = registered[0].component;
function render(t, gone) {
  resetHooks();
  // The component reads elapsed ms from its rAF loop, which this harness does
  // not run; seed the two state slots directly: [0] = elapsed, [1] = gone.
  hooks.states[0] = t;
  hooks.states[1] = !!gone;
  return C({});
}

const samples = [0, 900, 3000, 4500, 5000, 5200, 5600, 6200, 7000];
let sawLog = false, sawTitle = false, sawGlitch = false;
for (const t of samples) {
  const tree = render(t, false);
  if (tree === null) { fail('rendered null before the sequence ended at t=' + t); continue; }
  const json = JSON.stringify(tree);
  if (json.includes('DSHACPICPU')) sawLog = true;
  if (json.includes('DEEPSEEK')) sawTitle = true;
  if (json.includes('"data-glitch":"1"')) sawGlitch = true;
}
if (!sawLog) fail('no log text rendered in the log phase');
else ok('boot log renders');
if (!sawTitle) fail('title never rendered');
else ok('title renders');
if (!sawGlitch) fail('glitch phase never reached');
else ok('glitch phase reached');

// the self-unmount guard: once the loop sets gone, the component renders nothing
if (render(9000, true) !== null) fail('component does not unmount when gone=true');
else ok('component returns null once finished (self-unmount guard works)');

// ---- regression checks for the four review points -----------------------
// (1) white, not blue
if (/--r:\s*127/.test(stylesheets[0]) || /rgb\(var\(--r\)/.test(stylesheets[0])) {
  fail('stylesheet still uses the blue rgb(var(--r)...) palette');
} else ok('palette is white/neutral (no blue triple)');
if (!stylesheets[0].includes('#eef2f7')) fail('white foreground token missing');
else ok('white foreground #eef2f7 present');

// (2) corners: the boot title plate is a plain rectangle in eDEX; the chamfer
// lives on the outer frame, and only on the bl + tr corners (augmented-ui
// "bl-clip tr-clip"), not all four.
if (!stylesheets[0].includes('clip-path: polygon(')) fail('no chamfered frame');
else ok('chamfered frame present');
if (!/\.dshboot__frame\s*\{[\s\S]*?clip-path/.test(stylesheets[0])) fail('frame has no clip-path');
else ok('clip-path is on the frame');
const frameRule = (stylesheets[0].match(/\.dshboot__frame\s*\{[\s\S]*?\}/) || [''])[0];
if (!frameRule.includes('--fb')) fail('frame chamfer not parameterised');
else ok('frame chamfer parameterised');
// the title plate must NOT be chamfered (that was the wrong guess before)
const titleRule = (stylesheets[0].match(/\.dshboot__title\s*\{[\s\S]*?\}/) || [''])[0];
if (titleRule.includes('clip-path')) fail('title plate should be a plain rectangle, not chamfered');
else ok('title plate is a plain rectangle (matches eDEX)');

// (3) smooth hand-off
if (!stylesheets[0].includes('transition: opacity')) fail('no opacity transition for the hand-off');
else ok('overlay fades out (opacity transition)');
if (!code.includes("'data-leaving'")) {
  fail('component never sets data-leaving');
} else ok('component drives data-leaving');

// (4) sound: eDEX's own wav cues, inlined as data: URLs (the plugin asset
// route serves images only, so a .wav reference could never resolve)
if (!code.includes('AudioContext')) fail('no AudioContext');
else ok('Web Audio playback present');
const audioInline = (code.match(/data:audio\/wav;base64,/g) || []).length;
if (audioInline !== 3) fail('expected 3 inlined wav cues, found ' + audioInline);
else ok('3 eDEX wav cues inlined');
if (code.includes('require.asset(')) fail('still uses require.asset for audio (not served)');
else ok('audio does not rely on the asset route');
if (!code.includes("=== 'Boot Complete'")) fail('Boot Complete cue not keyed to that line');
else ok('chime is keyed to the "Boot Complete" line');

// (5) mascot: must use the real /plugins/<pkg>/assets/ route
if (!code.includes('whalegirl.webp')) fail('mascot asset not referenced');
else ok('whale-girl mascot referenced');
if (!/\/plugins\/[^'"\s]+\/assets\/mascot\/whalegirl\.webp/.test(code)) {
  fail('mascot URL is not a /plugins/<pkg>/assets/ route');
} else ok('mascot uses the plugin asset route');

console.log(process.exitCode ? '\nCONTRACT FAILED' : '\nCONTRACT PASSED');
