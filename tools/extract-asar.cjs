// Extract one file out of app.asar so shipped manifests can be read.
const fs = require('fs');
const ASAR = process.argv[2];
const WANT = process.argv[3];

const fd = fs.openSync(ASAR, 'r');
const head = Buffer.alloc(16);
fs.readSync(fd, head, 0, 16, 0);
const jsonSize = head.readUInt32LE(12);
const json = Buffer.alloc(jsonSize);
fs.readSync(fd, json, 0, jsonSize, 16);
const header = JSON.parse(json.toString('utf8').replace(/\0+$/, ''));

let node = header;
for (const part of WANT.split('/').filter(Boolean)) {
  if (!node.files || !node.files[part]) { console.error('not found: ' + part); process.exit(2); }
  node = node.files[part];
}
if (!node.offset) { console.error('is a directory'); process.exit(2); }

// Header layout: u32 @4 = string table size, u32 @8 = header size.
// The JSON actually starts at byte 16 in this asar build.
const dataBase = 16 + jsonSize;
const buf = Buffer.alloc(node.size);
fs.readSync(fd, buf, 0, node.size, dataBase + Number(node.offset));
process.stdout.write(buf.toString('utf8'));
