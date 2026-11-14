// Pre-install checks for the boot-sequence bundle (run before install_bundle).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const fail = msg => { console.error('FAIL: ' + msg); process.exitCode = 1; };
const ok = msg => console.log('ok   ' + msg);

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

// manifest
if (!pkg.dsh || !pkg.dsh.bundle || !pkg.dsh.bundle.patch) fail('dsh.bundle.patch missing');
else ok('bundle patch declared: ' + pkg.dsh.bundle.patch);
if (!pkg.dsh.client || pkg.dsh.client.platform !== 'web') fail('dsh.client.platform must be web');
else ok('client platform: web, immediately=' + pkg.dsh.client.immediately);

// A stale `external`/`inject` entry naming a non-resolvable specifier makes the
// whole web-boot entry fail; only Harness Client package ids may appear there.
const badClientFields = ['external', 'inject'].filter(f => (pkg.dsh.client[f] || []).some(s => s.startsWith('.')));
if (badClientFields.length) fail('dsh.client.' + badClientFields.join('/') + ' must not list relative paths');
else ok('dsh.client has no relative specifiers');
if (!pkg.exports['./client']) fail('missing ./client export');
else ok('./client export present');

// every file a linked directory ships must exist
for (const entry of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg',
                     'locale/en.json', 'locale/zh.json']) {
  if (!fs.existsSync(path.join(ROOT, entry))) fail('missing ' + entry);
}
ok('runtime + locale + icon files present');

// locales
for (const loc of ['en', 'zh']) {
  const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'locale', loc + '.json'), 'utf8'));
  if (!dict.meta || !dict.meta.title || !dict.meta.description) fail(loc + ' meta incomplete');
  else ok(loc + ' meta: ' + dict.meta.title);
}

// icon: valid svg, inside the size limit
const icon = fs.readFileSync(path.join(ROOT, 'icon.svg'));
if (icon.length > 256 * 1024) fail('icon over 256 KiB');
else if (!icon.toString('utf8').trimStart().startsWith('<svg')) fail('icon is not svg');
else ok('icon.svg ' + icon.length + ' bytes');

// client module: syntax + no leftover build placeholders + expected wiring
const client = fs.readFileSync(path.join(ROOT, 'client.js'), 'utf8');
if (/__BOOT_(DATA|CSS)__/.test(client)) fail('unsubstituted build placeholder in client.js');
else ok('build placeholders substituted');
if (!client.includes('data:font/woff2;base64,')) fail('inlined fonts missing');
else ok('fonts inlined');
if (!client.includes("inject('shell.overlay'")) fail('overlay not registered on shell.overlay');
else ok('registers into shell.overlay');
if (!client.includes("id: 'dsh-boot-sequence'")) fail('overlay id missing');
else ok('overlay id: dsh-boot-sequence');
if ((client.match(/ctx\.effect\(/g) || []).length < 2) fail('resources not wrapped in ctx.effect');
else ok('stylesheet + registration both inside ctx.effect');

// `slots` must be a hard dependency, or ctx.slots is undefined and apply() throws
if (!/inject:\s*\['slots'\]/.test(client)) fail("missing inject: ['slots'] on the client module");
else ok("client injects 'slots'");

// no foreign imports: only React comes from the module table
const requires = [...client.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
if (requires.some(r => r !== 'react')) fail('unexpected require: ' + requires.join(','));
else ok('requires only react');

// `styles` is NOT a runtime builtin in this build (dsh-client-modules exposes
// only ctx / React / host). Using it throws at apply() time and the whole
// web-boot entry fails, so the plugin must inject its own <style> tag.
if (/\bstyles\.insert\b/.test(client)) fail('client.js calls styles.insert, which does not exist in this runtime');
else ok('no dependence on the styles builtin');
if (!client.includes("createElement('style')") && !client.includes('createElement("style")')) {
  fail('client.js never injects a <style> tag');
} else ok('injects its own <style> tag');

// a `Style` tag the module creates must be tagged so HMR/unload can claim it
if (!client.includes('data-plugin-css')) fail('style tag is not tagged with data-plugin-css');
else ok('style tag is tagged for claim/cleanup');

// The plugin asset route serves images only (svg/png/webp/jpg), so any asset
// the client asks for must be an image that exists on disk. Audio is inlined.
// The route is /plugins/<pkg>/assets/<rest>; <rest> is resolved under the
// package's assets/ directory, so the on-disk path is "assets/" + rest.
const routeRefs = [...client.matchAll(/\/plugins\/(@[^/'"\s]+\/[^/'"\s]+|[^@/'"\s][^/'"\s]*)\/assets\/([^'"\s]+)/g)]
  .filter(([, pkgName, rest]) => !pkgName.includes('<') && !rest.includes('<'))
  .map(([, pkgName, rest]) => [pkgName, 'assets/' + rest]);
if (routeRefs.length === 0) fail('client references no /plugins/.../assets/ route');
for (const [pkgName, rel] of routeRefs) {
  if (pkgName !== pkg.name) fail(`asset route names ${pkgName}, expected ${pkg.name}`);
  // The host resolves "<package>/assets/<rest>" through Node, so the file must
  // live under the package's own assets/ dir AND match an export pattern.
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) fail('missing shipped asset: ' + rel);
  else ok(`asset ships: ${rel} (${Math.round(fs.statSync(p).size / 1024)} KiB)`);
  if (!rel.startsWith('assets/')) fail(`${rel} is not under assets/ (route would 404)`);
  else ok(`asset path is under assets/: ${rel}`);
  const exp = pkg.exports || {};
  const matched = Object.keys(exp).some(k =>
    k === './' + rel ||
    (k.includes('*') && new RegExp('^' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\*', '.*') + '$').test('./' + rel)));
  if (!matched) fail(`no export matches ./${rel} (Node resolve would throw -> 404)`);
  else ok(`export map covers ./${rel}`);
}

const inlined = (client.match(/data:audio\/wav;base64,/g) || []).length;
if (inlined !== 3) fail('expected 3 inlined wav cues, found ' + inlined);
else ok('3 wav cues inlined (asset route cannot serve audio)');

// third-party art/music must keep its attribution
if (!fs.existsSync(path.join(ROOT, 'CREDITS.md'))) fail('CREDITS.md missing (CC BY-NC-SA requires attribution)');
else ok('CREDITS.md present');

// Native Windows chrome (caption buttons + App/Edit menu) lives outside the
// document, so it can only be hidden by the token override the preload mirrors.
if (!client.includes('html.dshboot-active')) fail('no html.dshboot-active token override');
else ok('hides native chrome via token override');
for (const token of ['--dsw-specific-sidebar-fill', '--dsw-alias-label-primary']) {
  if (!new RegExp(token + ':\\s*#[0-9a-f]{6}\\s*!important', 'i').test(client)) {
    fail(token + ' override missing !important (body-scoped definitions would win)');
  } else ok(token + ' overridden');
}
if (!client.includes('[data-windows-menu]')) fail('preload menu bar not hidden');
else ok('preload menu bar hidden');

const patch = fs.readFileSync(path.join(ROOT, 'cordis.patch.yml'), 'utf8');
if (!patch.includes(pkg.name)) fail('patch does not reference the package name');
else ok('patch names ' + pkg.name);

console.log(process.exitCode ? '\nPRECHECK FAILED' : '\nPRECHECK PASSED');
