#!/usr/bin/env python3
"""Stamp provenance into the friend-facing standalone preview.

Two distinct layers, kept separate on purpose:

  * 你的归属 (Shifu-HU) —— 适用于你写的这部分：时序编排、时间轴、渲染、
    打包、以及把这套东西做成可用开工件的全部工作。
  * 上游署名 —— 鲸鱼娘 (CC BY-NC-SA 4.0, 四位作者) 与 eDEX-UI 音效
    (GPL-3.0)。这两样不是你的财产，不能声称独占，但必须保留署名。

The stamp is not just a comment: a visible credit panel and a machine-readable
JSON block are written into the page, plus a per-build fingerprint so a copied
file can be traced back.
"""
import base64
import json
import re
import hashlib
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(r"C:/deepseek harness/dsh-boot-plugin")
OUT = Path(r"C:/Users/Shifu_HU/Desktop/dsh-boot")
CLIENT = ROOT / "client.js"

OWNER = "Shifu-HU"
GITHUB = "https://github.com/Shifu-HU"

client = CLIENT.read_text(encoding="utf-8")

# ---- extract the generated literals --------------------------------------
m = re.search(r"const FONT_CSS = (\"(?:[^\"\\]|\\.)*\");", client)
font_css = json.loads(m.group(1)) if m else ""

m = re.search(r"const AUDIO = (\{.*?\});\s*\n", client, re.S)
audio = json.loads(m.group(1)) if m else {}

m = re.search(r"const LAYOUT_CSS = `(.*?)`;\n", client, re.S)
layout_css = m.group(1) if m else ""

log_src = (ROOT / "build" / "boot-log.js").read_text(encoding="utf-8")
start = log_src.index("__DSH_BOOT__ = ")
boot_literal = log_src[log_src.index("{", start): log_src.rindex("}") + 1]

mascot = (ROOT / "assets" / "mascot" / "whalegirl.webp").read_bytes()
mascot_b64 = base64.b64encode(mascot).decode("ascii")

built = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")

# ---- build fingerprint: traceable if the file is passed around -----------
h = hashlib.sha256()
h.update(client.encode("utf-8"))
h.update(mascot)
for k in sorted(audio):
    h.update(audio[k].encode("utf-8"))
fingerprint = h.hexdigest()

provenance = {
    "work": "eDEX-style boot sequence for the agent runtime",
    "owner": OWNER,
    "homepage": GITHUB,
    "builtAt": built,
    "fingerprint": fingerprint,
    "license": {
        "ownerCode": "All rights reserved by the author unless stated otherwise.",
        "mascot": "CC BY-NC-SA 4.0 — upstream authors: 上善无形（上善）, ZipZipPipe, YunYueSama, xiaoweigen",
        "audio": "eDEX-UI audio cues — GitSquared/edex-ui, GPL-3.0",
        "note": "上游素材不随本作品转授独占权利；再分发请保留本段署名。",
    },
}

html = f"""<!DOCTYPE html>
<html lang="zh" data-owner="{OWNER}">
<head>
<meta charset="utf-8">
<title>eDEX boot sequence — {OWNER}</title>
<meta name="author" content="{OWNER}">
<meta name="github" content="{GITHUB}">
<!--
  ============================================================================
  归属 / Attribution
  ----------------------------------------------------------------------------
  本项目（时序编排、渲染实现、打包）由 {OWNER} 制作。
  Homepage: {GITHUB}

  构建指纹 fingerprint: {fingerprint}
  构建时间 builtAt:      {built}

  上游素材署名（不可移除）:
    · 鲸鱼娘形象 — CC BY-NC-SA 4.0
      上善无形（上善）· ZipZipPipe · YunYueSama · xiaoweigen
      https://github.com/xiaoweigen/deepseek-dafeiyu-assets
    · 启动音效 — GitSquared/edex-ui, GPL-3.0

  以上上游素材不构成 {OWNER} 的独占财产；再分发须保留本段。
  ============================================================================
-->
<style>
{font_css}
</style>
<style>
{layout_css}
html, body {{ margin: 0; height: 100%; background: #05080d; overflow: hidden; }}
#stage {{ position: fixed; inset: 0; }}
</style>
<style>
/* ---- provenance: visible card + watermark --------------------------- */
.edx-credit {{
  position: fixed; left: 14px; bottom: 14px; z-index: 40;
  max-width: 420px; padding: 10px 13px;
  border: 1px solid rgba(170,207,209,.28);
  background: rgba(5,8,13,.92);
  color: rgba(170,207,209,.82);
  font: 11px/1.65 "DSH Boot Mono", ui-monospace, monospace;
  letter-spacing: .02em;
  transition: opacity .3s ease;
}}
.edx-credit b {{ color: #eef2f7; font-weight: 600; letter-spacing: .06em; }}
.edx-credit .dim {{ color: rgba(170,207,209,.5); }}
.edx-credit a {{ color: rgba(150,200,255,.9); text-decoration: none; }}
.edx-credit.hidden {{ opacity: 0; pointer-events: none; }}
.edx-mark {{
  position: fixed; right: 16px; bottom: 14px; z-index: 40;
  font: 10px "DSH Boot Mono", ui-monospace, monospace;
  letter-spacing: .18em; text-transform: uppercase;
  color: rgba(170,207,209,.34);
  pointer-events: none; user-select: none;
}}
</style>
</head>
<body>
<div id="stage"></div>

<div class="edx-credit" id="credit">
  <b>eDEX boot sequence</b><br>
  <span class="dim">by</span> {OWNER}
  <span class="dim">·</span> <a href="{GITHUB}" target="_blank" rel="noreferrer">{GITHUB.replace('https://', '')}</a><br>
  <span class="dim">构建 {built} · 指纹 {fingerprint[:16]}</span><br>
  <span class="dim">鲸鱼娘 CC BY-NC-SA 4.0（上善无形 / ZipZipPipe / YunYueSama / xiaoweigen）</span><br>
  <span class="dim">音效 eDEX-UI · GitSquared · GPL-3.0</span>
</div>
<div class="edx-mark">{OWNER}</div>

<script type="application/json" id="provenance">
{json.dumps(provenance, ensure_ascii=False, indent=2)}
</script>
<script>
const BOOT = {boot_literal};
const MASCOT_URL = "data:image/webp;base64,{mascot_b64}";
const AUDIO = {json.dumps(audio)};
const OWNER = {json.dumps(OWNER)};
const FINGERPRINT = {json.dumps(fingerprint)};

const TITLE_FADE = 300;
const DEREZZER_MS = 50;

function buildTimeline(lines) {{
  const lineAt = [];
  let t = 0;
  for (let i = 0; i < lines.length; i++) {{
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
  }}
  const T = {{ clear: t + 300 }};
  T.title = T.clear + 400;
  T.solid = T.title + 200;
  T.band = T.solid + 100;
  T.frame = T.band + 300;
  T.glitch = T.frame + 100;
  T.calm = T.glitch + 500;
  T.remove = T.calm + 1000;
  T.end = T.remove + 700;
  return {{ lineAt, T }};
}}

const {{ lineAt, T }} = buildTimeline(BOOT.lines);
const banner = 'the agent runtime Kernel version ' + BOOT.version +
  ' boot at ' + new Date().toString() + '; root:xnu-1699.22.73~1/RELEASE_X86_64';

let ac = null, buffers = {{}};
function audioCtx() {{
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  for (const k of Object.keys(AUDIO)) {{
    try {{
      const b64 = AUDIO[k].slice(AUDIO[k].indexOf(',') + 1);
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      ac.decodeAudioData(bytes.buffer.slice(0), b => {{ buffers[k] = b; }}, () => {{}});
    }} catch (e) {{}}
  }}
  return ac;
}}
function play(key, gain) {{
  const c = audioCtx(); if (!c || !buffers[key]) return;
  if (c.state === 'suspended') c.resume().catch(() => {{}});
  const s = c.createBufferSource(); s.buffer = buffers[key];
  const g = c.createGain(); g.gain.value = gain;
  s.connect(g).connect(c.destination); s.start();
}}
window.addEventListener('pointerdown', () => audioCtx(), {{ once: true }});

const stage = document.getElementById('stage');
const credit = document.getElementById('credit');
const played = new Set();
let raf = 0, t0 = 0;

function el(tag, props, kids) {{
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {{}})) {{
    if (k === 'style') for (const [sk, sv] of Object.entries(v)) e.style.setProperty(sk, sv);
    else if (k === 'className') e.className = v;
    else e.setAttribute(k, v);
  }}
  for (const kid of kids || []) if (kid) e.appendChild(kid);
  return e;
}}

function frame(t) {{
  const inLog = t < T.clear;
  const frag = document.createDocumentFragment();

  const inA = Math.min(1, Math.max(0, (t - 350) / 900));
  const outA = Math.min(1, Math.max(0, (t - T.remove) / 500));
  if (inA > 0 && outA < 1) {{
    frag.appendChild(el('div', {{ className: 'dshboot__mascot-bed',
      style: {{ opacity: (inA * (1 - outA) * 0.9).toFixed(3) }} }}));
    const wrap = el('div', {{ className: 'dshboot__mascot-wrap',
      style: {{ opacity: (inA * (1 - outA)).toFixed(3) }} }});
    wrap.appendChild(el('img', {{ className: 'dshboot__mascot', src: MASCOT_URL,
      style: {{ transform: 'translateY(' + ((1 - inA) * 1.4).toFixed(2) + 'vh)' }} }}));
    frag.appendChild(wrap);
  }}

  if (inLog) {{
    const screen = el('div', {{ className: 'dshboot__screen', 'data-center': '0' }});
    let n = 0;
    for (let i = 0; i < lineAt.length; i++) if (t >= lineAt[i]) n = i + 1;
    for (let i = 0; i < n; i++) {{
      screen.appendChild(el('div', {{ className: 'dshboot__ln' }}, [document.createTextNode(BOOT.lines[i])]));
      if (i === 1) screen.appendChild(el('div', {{ className: 'dshboot__ln dshboot__ln--banner' }}, [document.createTextNode(banner)]));
    }}
    const live = t < lineAt[lineAt.length - 1];
    screen.appendChild(el('div', {{ className: 'dshboot__ln' }},
      live ? [el('span', {{ className: 'dshboot__caret' }})] : []));
    frag.appendChild(screen);
  }} else {{
    const screen = el('div', {{ className: 'dshboot__screen', 'data-center': '1' }});
    if (t >= T.title) {{
      const glitching = t >= T.glitch && t < T.calm;
      const band = t >= T.band && t < T.frame;
      const box = (t >= T.frame && t < T.glitch) || t >= T.calm;
      let dzT = -1, dzB = 1;
      if (glitching) {{
        const ph = ((t - T.glitch) / DEREZZER_MS) % 2;
        const k = ph < 1 ? 1 - ph : ph - 1;
        dzT = -1 - 4 * k; dzB = 1 + 2 * k;
      }}
      screen.appendChild(el('div', {{
        className: 'dshboot__title',
        'data-text': BOOT.title,
        'data-glitch': glitching ? '1' : '0',
        'data-band': band ? '1' : '0',
        'data-box': box ? '1' : '0',
        style: {{
          opacity: Math.min(1, Math.max(0, (t - T.title) / TITLE_FADE)).toFixed(3),
          '--dz-top': dzT + '%', '--dz-bottom': dzB + '%',
        }},
      }}, [document.createTextNode(BOOT.title)]));
    }}
    frag.appendChild(screen);
  }}

  frag.appendChild(el('div', {{ className: 'dshboot__frame' }}));
  frag.appendChild(el('div', {{ className: 'dshboot__tick dshboot__tick--tl' }}));
  frag.appendChild(el('div', {{ className: 'dshboot__tick dshboot__tick--br' }}));
  frag.appendChild(el('div', {{ className: 'dshboot__crt' }}));
  frag.appendChild(el('div', {{ className: 'dshboot__sweep' }}));
  frag.appendChild(el('div', {{ className: 'dshboot__vig' }}));
  frag.appendChild(el('div', {{ className: 'dshboot__skip' }}, [document.createTextNode('esc to skip')]));

  const root = el('div', {{ className: 'dshboot' }}, []);
  root.appendChild(frag);
  stage.replaceChildren(root);

  for (let i = 0; i < lineAt.length; i++) {{
    if (t >= lineAt[i] && !played.has('l' + i)) {{
      played.add('l' + i);
      if (BOOT.lines[i] === 'Boot Complete') play('granted', 0.55);
      else play('stdout', 0.45);
    }}
  }}
  if (t >= T.title && !played.has('theme')) {{ played.add('theme'); play('theme', 0.4); }}
}}

function loop(now) {{
  if (!t0) t0 = now;
  const t = now - t0;
  frame(t);
  if (t < T.end) raf = requestAnimationFrame(loop);
  else credit.classList.remove('hidden');
}}

window.addEventListener('keydown', e => {{
  if (e.key === 'Escape') {{
    cancelAnimationFrame(raf);
    stage.replaceChildren();
    credit.classList.remove('hidden');
  }}
}});

// passive tracer: leaves this build's fingerprint on the page for anyone who
// opens DevTools and asks where the file came from
Object.defineProperty(window, '__EDEX_PROVENANCE__', {{
  value: Object.freeze({{ owner: OWNER, fingerprint: FINGERPRINT, url: {json.dumps(GITHUB)} }}),
  writable: false, configurable: false, enumerable: true,
}});

requestAnimationFrame(loop);
</script>
</body>
</html>
"""

target = OUT / "boot-preview.html"
target.write_text(html, encoding="utf-8")
print("wrote", target, round(len(html) / 1024), "KiB")
print("owner:", OWNER)
print("fingerprint:", fingerprint)
