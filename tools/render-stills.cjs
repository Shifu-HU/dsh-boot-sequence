// Render the real client.js plugin in headless Chromium at chosen timestamps,
// with a stubbed module loader + minimal React, so the visual change can be
// reviewed without touching the running app.
//
//   node tools/render-stills.js 1200,4200,5600
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "out");
const code = fs.readFileSync(path.join(ROOT, "client.js"), "utf8");
const times = (process.argv[2] || "1200,4200,5600").split(",").map(Number);

// inline every package asset the client may ask for
const assetMap = {};
for (const rel of ["assets/mascot/whalegirl.webp", "assets/audio/stdout.wav", "assets/audio/granted.wav", "assets/audio/theme.wav"]) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) continue;
  const mime = rel.endsWith(".webp") ? "image/webp" : "audio/wav";
  assetMap[rel] = `data:${mime};base64,${fs.readFileSync(p).toString("base64")}`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

  // A tiny hook-driven React stand-in: enough for this component's shape.
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
    <style>html,body{margin:0;height:100%;background:#0b0e13}</style></head>
    <body><div id="app"></div>
    <script>
      const code = ${JSON.stringify(code)};
      const st = { states: [], cursor: 0, effects: [] };

      function createElement(type, props, ...kids) {
        if (typeof type === 'function') return { type, props: props || {}, kids };
        return { tag: type, props: props || {}, kids };
      }
      const React = {
        createElement,
        useState(init) {
          const i = st.cursor++;
          if (!(i in st.states)) st.states[i] = typeof init === 'function' ? init() : init;
          return [st.states[i], v => { st.states[i] = typeof v === 'function' ? v(st.states[i]) : v; }];
        },
        useMemo(fn) { return fn(); },
        useRef(v) { const i = 'r' + (st.cursor++); if (!(i in st.states)) st.states[i] = { current: v }; return st.states[i]; },
        useEffect(fn) { st.effects.push(fn); return undefined; },
      };

      window.__ModuleLoader__ = { load(m) { window.__MOD = m; } };
      eval(code);

      // package assets: real code uses the /plugins/<pkg>/assets/<path> route.
      // In this harness there is no such route, so map it onto the inlined map.
      const ASSETS = ${JSON.stringify(assetMap)};
      window.__resolveAsset = url => {
        const m = /\\/assets\\/(.+)$/.exec(url || '');
        return (m && ASSETS['assets/' + m[1]]) || (m && ASSETS[m[1]]) || url || '';
      };
      const mod = window.__MOD.factory(Object.assign(
        s => { if (s === 'react') return React; throw new Error('require ' + s); },
        { asset: ref => ASSETS[ref] || '' }
      ));

      let comp = null;
      const ctx = {
        effect(fn) { fn(); return () => {}; },
        slots: {
          inject(slot, cb) { return cb(); },
          register(opts, c) { comp = c; return () => {}; },
        },
      };
      mod.apply(ctx);

      const SVG = new Set(['svg', 'path', 'circle', 'rect', 'g', 'line']);
      // the plugin sets img src to the /plugins route; rewrite it to the
      // inlined data URL so this harness can render the real element
      const FIX_ATTR = { src: v => window.__resolveAsset(v) };
      function toDom(node) {
        if (node === null || node === undefined || node === false) return document.createTextNode('');
        if (typeof node === 'string' || typeof node === 'number') return document.createTextNode(String(node));
        if (node.tag === undefined) return document.createTextNode('');
        const isSvg = SVG.has(node.tag);
        const el = isSvg
          ? document.createElementNS('http://www.w3.org/2000/svg', node.tag)
          : document.createElement(node.tag);
        for (const [k, v] of Object.entries(node.props)) {
          if (k === 'key' || k === 'style' || k === 'children') continue;
          if (v === undefined || v === null) continue;
          // React calls it className; the DOM wants class
          const name = k === 'className' ? 'class' : k;
          const value = (name === 'src' && typeof v === 'string') ? window.__resolveAsset(v) : String(v);
          el.setAttribute(name, value);
        }
        if (node.props.style) for (const [k, v] of Object.entries(node.props.style)) {
          if (k.startsWith('--')) el.style.setProperty(k, v); else el.style[k] = v;
        }
        for (const kid of node.kids || []) {
          // children may be nested arrays (map results); flatten them
          const add = k => {
            if (Array.isArray(k)) { k.forEach(add); return; }
            el.appendChild(toDom(k));
          };
          add(kid);
        }
        return el;
      }

      // render the component at a given elapsed time
      window.renderAt = (t, leaving) => {
        // pass 1: let the component create its state slots
        st.states = []; st.cursor = 0; st.effects = [];
        comp({});
        // pass 2: the SAME hook positions, with the clock seeded
        st.cursor = 0;
        st.states[0] = t;      // elapsed ms
        st.states[1] = false;  // gone
        const tree = comp({});
        const host = document.getElementById('app');
        host.replaceChildren(toDom(tree));
        const root = host.firstElementChild;
        if (root && leaving) root.setAttribute('data-leaving', '1');
        return !!root;
      };
    </script></body></html>`);

  for (const t of times) {
    await page.evaluate(t => window.renderAt(t, false), t);
    await page.waitForTimeout(180);
    const f = path.join(OUT, `plugin_${String(t).padStart(5, "0")}.png`);
    await page.screenshot({ path: f });
    console.log("rendered", t, "->", path.relative(ROOT, f));
  }

  // the hand-off frame
  await page.evaluate(() => window.renderAt(7100, true));
  await page.waitForTimeout(120);
  const lf = path.join(OUT, "plugin_leaving.png");
  await page.screenshot({ path: lf });
  console.log("rendered leaving ->", path.relative(ROOT, lf));

  if (errors.length) console.error("PAGE ERRORS:\n" + errors.join("\n"));
  await browser.close();
})();
