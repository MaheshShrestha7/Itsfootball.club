// Post-deploy check: if key pages don't return 200, roll production back to the previous version.
import { execSync } from 'node:child_process';

const paths = ['/', '/about'];
const ok = async (p) => (await fetch(`https://itsfootball.club${p}`, { redirect: 'manual' })).status === 200;

for (let attempt = 1; attempt <= 3; attempt++) {
  await new Promise((r) => setTimeout(r, 5000)); // let the new version propagate
  const results = await Promise.all(paths.map(ok));
  if (results.every(Boolean)) { console.log('Smoke test passed.'); process.exit(0); }
  console.warn(`Smoke test attempt ${attempt} failed:`, paths.filter((_, i) => !results[i]));
}

console.error('Smoke test failed — rolling back to the previous version.');
execSync('npx wrangler rollback -y --message "Auto-rollback: smoke test failed"', { stdio: 'inherit' });
process.exit(1);
