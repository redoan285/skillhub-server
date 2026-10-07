import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.SKILLHUB_TEST_PORT ?? 41993);
const origin = 'http://localhost:5173';
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, PORT: String(port), NODE_ENV: 'test', DEMO_MODE: 'true', MONGODB_URI: '', FIREBASE_SERVICE_ACCOUNT_JSON: '', ALLOWED_ORIGINS: origin };
const server = spawn(process.execPath, [path.join(root, 'dist/src/server.js')], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
let output = '';
server.stdout.on('data', (chunk) => { output += chunk.toString(); });
server.stderr.on('data', (chunk) => { output += chunk.toString(); });

async function waitForHealth() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`API exited before health check.\n${output}`);
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) return response;
    } catch { /* wait for listener */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`API did not become healthy.\n${output}`);
}

try {
  const health = await waitForHealth();
  const healthBody = await health.json();
  assert.equal(healthBody.status, 'ok');
  assert.equal(healthBody.service, 'SkillHub API');

  const preflight = await fetch(`${base}/api/auth/demo`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' },
  });
  assert.ok(preflight.status === 200 || preflight.status === 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
  assert.match(preflight.headers.get('access-control-allow-headers') ?? '', /authorization/i);

  const login = await fetch(`${base}/api/auth/demo`, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'instructor' }),
  });
  assert.equal(login.status, 200);
  const session = await login.json();
  assert.equal(session.user.role, 'instructor');
  assert.ok(session.token.startsWith('demo:'));

  const dashboard = await fetch(`${base}/api/dashboard`, {
    headers: { Origin: origin, Authorization: `Bearer ${session.token}` },
  });
  assert.equal(dashboard.status, 200);
  assert.equal((await dashboard.json()).user.role, 'instructor');

  const blockedAdmin = await fetch(`${base}/api/admin/overview`);
  assert.equal(blockedAdmin.status, 401);
  console.log('PASS: API health, configured CORS preflight, demo session, instructor dashboard, admin auth guard.');
} finally {
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => server.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 1500)),
  ]);
}
