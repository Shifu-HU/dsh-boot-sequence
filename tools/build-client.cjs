// Build step: fold the boot data and inlined fonts into client.js.
// Keeps the big literals out of hand-edited source while shipping a single,
// dependency-free Client module (no subpath require semantics to rely on).
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(ROOT, p), "utf8");

// The template embeds CSS in template literals, so a stray backtick or "${"
// inside a comment silently truncates the literal. Catch it here rather than
// discovering it as a whitespace-looking parse error later.
{
  const tpl = read("src/client.template.js");
  try {
    new (require("vm").Script)(tpl, { filename: "src/client.template.js" });
  } catch (e) {
    console.error("src/client.template.js does not parse:", e.message);
    console.error("Most likely an unbalanced backtick or ${ inside a CSS comment.");
    process.exit(1);
  }
}

// build/boot-log.js assigns `window.__DSH_BOOT__ = {...};`
const logSrc = read("build/boot-log.js");
const start = logSrc.indexOf("__DSH_BOOT__ = ");
if (start < 0) throw new Error("build/boot-log.js: assignment not found");
const open = logSrc.indexOf("{", start);
const close = logSrc.lastIndexOf("}");
const literal = logSrc.slice(open, close + 1);
// It is a JS object literal (single quotes, unquoted keys), so validate by
// evaluating it in an isolated context rather than JSON.parse.
const bootData = new Function("return (" + literal + ")")();
if (!Array.isArray(bootData.lines) || bootData.lines.length !== 85) {
  throw new Error("boot log must keep 85 lines, got " + (bootData.lines || []).length);
}
if (!bootData.whale || !bootData.whale.silhouette) {
  throw new Error("boot data is missing the whale mark");
}

const fontCss = read("build/fonts.css").trimEnd();
if (!fontCss.includes("data:font/woff2;base64,")) {
  throw new Error("build/fonts.css is missing the inlined faces");
}

let client = read("src/client.template.js");
if (!client.includes("__BOOT_CSS__") || !client.includes("__BOOT_DATA__")) {
  throw new Error("template placeholders missing");
}
if (!client.includes("__BOOT_AUDIO__")) {
  throw new Error("template is missing the __BOOT_AUDIO__ placeholder");
}

// Audio must be inlined: the plugin asset route only serves svg/png/webp/jpg
// (PACKAGE_ASSET_MEDIA_TYPES in dsh-client-modules), so a .wav reference can
// never resolve. Base64 keeps the three eDEX cues working with no server.
const audioDir = path.join(ROOT, "audio");
const audioMap = {};
for (const name of ["stdout", "granted", "theme"]) {
  const file = path.join(audioDir, `${name}.wav`);
  if (!fs.existsSync(file)) throw new Error("missing audio: " + file);
  audioMap[name] = "data:audio/wav;base64," + fs.readFileSync(file).toString("base64");
}

client = client
  .replace("__BOOT_CSS__", () => JSON.stringify(fontCss))
  .replace("__BOOT_DATA__", () => literal)
  .replace("__BOOT_AUDIO__", () => JSON.stringify(audioMap));

// Guard the class of bug this file has already hit twice: a stray backtick or
// "${" inside a template-literal comment silently truncates the literal and the
// bundle fails to parse. Parse it here, before it reaches the app.
try {
  new (require("vm").Script)(client, { filename: "client.js" });
} catch (e) {
  console.error("\nGenerated client.js does not parse:", e.message);
  console.error("Look for an unbalanced backtick or ${ inside a CSS comment.");
  process.exit(1);
}

const out = path.join(ROOT, "client.js");
fs.writeFileSync(out, client);
console.log("wrote client.js", (client.length / 1024).toFixed(1), "KiB");
