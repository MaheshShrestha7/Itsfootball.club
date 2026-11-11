// Loaded into the Cloudflare build with NODE_OPTIONS=--require (see scripts/cf-build.sh).
// OpenNext patches the server bundle with one Promise.all over every traced file (~2,600), so that
// many files are open at once and the build box fails with "EMFILE: too many open files".
// This queues fs.promises file calls so at most MAX run at a time. Build only: never loaded by the site.
const fsp = require('node:fs').promises;
const MAX = 128;
let running = 0;
const waiting = [];
const release = () => { running--; const next = waiting.shift(); if (next) next(); };
const limit = fn => function limited(...args) {
  const run = () => { running++; return fn.apply(this, args).finally(release); };
  return running < MAX ? run() : new Promise(resolve => waiting.push(resolve)).then(run);
};
for (const name of ['readFile', 'writeFile', 'appendFile', 'copyFile', 'cp']) {
  if (typeof fsp[name] === 'function') fsp[name] = limit(fsp[name]);
}
