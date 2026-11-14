# dsh-edex-boot

An [eDEX-UI](https://github.com/GitSquared/edex-ui) style boot sequence for the
**the agent runtime** Web UI: a full-screen splash that prints an 85-line boot
log, lands a glitching title plate, and fades into the workspace.

[中文说明](README.zh-CN.md)

[![npm](https://img.shields.io/npm/v/dsh-edex-boot.svg)](https://www.npmjs.com/package/dsh-edex-boot)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![preview](https://raw.githubusercontent.com/Shifu-HU/dsh-edex-boot/main/docs/preview.png)

## Install

Published on npm: **[dsh-edex-boot](https://www.npmjs.com/package/dsh-edex-boot)**

### From the command line

```bash
dsh plugin --profile desktop add dsh-edex-boot
```

### From inside a session

```
plugin_manager install_bundle dsh-edex-boot
```

Pin a version when you do not want automatic upgrades:

```bash
dsh plugin --profile desktop add dsh-edex-boot@1.0.0
```

### From Git

```bash
dsh plugin --profile desktop add github:Shifu-HU/dsh-edex-boot
```

### From a local folder

```bash
dsh plugin --profile desktop add C:/path/to/dsh-edex-boot
```

Restart the desktop app after installing. The Client module is scanned at
startup, so a hot install does not take effect until the next launch.

## First use

Nothing to configure. Open the app and the sequence plays once, then removes
itself.

| Action | Result |
|---|---|
| `Esc` | Fade out immediately |
| Click anywhere | Fade out immediately |
| Wait ~8.5s | Plays through and fades into the workspace |

## How it behaves

- **One shot per page load.** It does not replay on session or route changes.
- **Self-removing.** The component returns `null` when finished; its timers,
  listeners and stylesheet are released.
- **Pointer-transparent.** It never swallows clicks after the fade starts.
- **Sound is optional.** Browsers block audio without a gesture, so the cues
  begin after your first click. Silence never blocks the animation.

## Uninstall

```bash
plugin_manager remove_bundle dsh-edex-boot
```

Or toggle it off in **Settings → Plugins**.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Nothing appears after install | Client modules are scanned at startup | Restart the desktop app |
| Blank screen instead of the log | Module failed to load | Check DevTools console for `slot entry crashed` |
| No sound | Browser autoplay policy | Click the page once during the animation |
| Mascot missing | Asset route blocked | Confirm `/plugins/dsh-edex-boot/assets/mascot/whalegirl.webp` returns 200 |
| Animation replays every navigation | Should not happen | Report it; the unmount guard is in `client.js` |

## Build from source

The shipped `client.js` is generated. Edit `src/client.template.js`, then:

```bash
python3 tools/build-fonts-css.py     # inline subset fonts
node tools/build-client.cjs          # fold data + fonts + audio into client.js
node tools/contract-test.cjs         # load-and-render contract
node tools/precheck.cjs              # manifest, assets, attribution
```

`tools/render-stills.cjs` renders the real component in headless Chromium for
visual checks.

## Limitations

- Text is English-only in the boot log; it mirrors eDEX-UI's console output.
- The mascot is line art traced from a third-party character sheet; it is
  **not** original artwork (see Credits).
- No configuration options yet.

## Credits

Third-party assets and their licenses are recorded in [CREDITS.md](CREDITS.md).

- Whale-girl mascot — CC BY-NC-SA 4.0, upstream authors 上善无形（上善）· ZipZipPipe · YunYueSama · xiaoweigen
- Boot audio — GitSquared/edex-ui, GPL-3.0

**The mascot is non-commercial.** Remove it before any commercial distribution.

## License

MIT for the plugin source — see [LICENSE](LICENSE). The bundled assets keep
their own licenses and are not relicensed by it.
