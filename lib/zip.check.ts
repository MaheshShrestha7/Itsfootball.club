// Self-check for the ZIP writer: CRC against the standard test vector and zlib, and the archive
// opened by reading its own directory back. Run: npx esbuild lib/zip.check.ts --bundle --platform=node --log-level=warning | node
import assert from 'node:assert/strict';
import { crc32 as zlibCrc32 } from 'node:zlib';
import { crc32, zipFiles } from './zip';

const enc = new TextEncoder();
assert.equal(crc32(enc.encode('123456789')), 0xcbf43926);
assert.equal(crc32(enc.encode('Westvale FC, Ünïcødé ⚽')), zlibCrc32('Westvale FC, Ünïcødé ⚽'));
assert.equal(crc32(new Uint8Array()), 0);

const files = [{ name: 'club.csv', text: 'name\nWestvale FC\n' }, { name: 'members/ñame.csv', text: '' }];
const zip = zipFiles(files, new Date(2026, 10, 3, 9, 30, 0));
const v = new DataView(zip.buffer);

// End record points at a central directory listing both files, each pointing at its local header
const end = zip.length - 22;
assert.equal(v.getUint32(end, true), 0x06054b50);
assert.equal(v.getUint16(end + 10, true), 2);
let at = v.getUint32(end + 16, true);
const dec = new TextDecoder();
for (const f of files) {
  assert.equal(v.getUint32(at, true), 0x02014b50);
  const nameLen = v.getUint16(at + 28, true);
  assert.equal(dec.decode(zip.subarray(at + 46, at + 46 + nameLen)), f.name);
  const local = v.getUint32(at + 42, true);
  assert.equal(v.getUint32(local, true), 0x04034b50);
  const size = v.getUint32(local + 18, true);
  const body = zip.subarray(local + 30 + nameLen, local + 30 + nameLen + size);
  assert.equal(dec.decode(body), f.text);
  assert.equal(v.getUint32(local + 14, true), crc32(body));
  at += 46 + nameLen;
}

console.log('zip: ok');
