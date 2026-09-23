/**
 * Always runs after the full suite, pass or fail: the server's guarded,
 * scoped cleanup plus verification (counts only). Fails the run if any E2E
 * order, payment confirmation, proof file, cart line or stock drift remains.
 */
import { spawnSync } from 'node:child_process';

export default async function globalTeardown() {
  delete process.env.E2E_GUEST_ORDER_TOKEN;
  const result = spawnSync('npm run e2e:db:cleanup', {
    cwd: process.env.E2E_SERVER_DIR,
    env: process.env,
    encoding: 'utf8',
    shell: true,
  });
  const lines = `${result.stdout}\n${result.stderr}`.split(/\r?\n/).filter((line) => line.startsWith('E2E cleanup') || /verification failed|SAFETY/.test(line));
  for (const line of lines) console.info(line);
  if (result.status !== 0) throw new Error('E2E cleanup/verification failed');
}
