import os from 'os';
import path from 'path';
import crypto from 'crypto';

// Use isolated temporary database for test
process.env.DB_PATH = path.join(os.tmpdir(), `mcspanel_test_p4_${crypto.randomBytes(4).toString('hex')}.db`);

import { buildApp } from './app';
import { getDb, closeDb } from './db';
import { config } from './config';
import fs from 'fs';

async function runPhase4Tests() {
  console.log('--- Starting Phase 4 Integration Tests (Frontend + Backend Serving) ---');
  console.log('Testing DB Path:', config.DB_PATH);

  const testDbPath = path.join(os.tmpdir(), `mcspanel_test_p4_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.db`);
  getDb(testDbPath);
  const app = buildApp();
  await app.ready();

  // Test 1: Health
  console.log('\n[Test 1] Testing /api/health...');
  const healthRes = await app.inject({ method: 'GET', url: '/api/health' });
  if (healthRes.statusCode !== 200) throw new Error('Health check failed');
  console.log('Health check passed.');

  // Test 2: Serving root / -> should return index.html of the built web app!
  console.log('\n[Test 2] Testing root / serving web/dist/index.html...');
  const rootRes = await app.inject({ method: 'GET', url: '/' });
  console.log('Status code:', rootRes.statusCode);
  if (rootRes.statusCode !== 200) throw new Error(`Root / did not return 200, got ${rootRes.statusCode}`);
  if (!rootRes.body.includes('<title>MCSPanel</title>')) {
    throw new Error('Root response did not contain MCSPanel HTML!');
  }
  console.log('Root SPA successfully served from web/dist!');

  // Test 3: SPA client-side fallback route (e.g. /dashboard) should also return index.html
  console.log('\n[Test 3] Testing SPA fallback route /dashboard...');
  const fallbackRes = await app.inject({ method: 'GET', url: '/dashboard' });
  if (fallbackRes.statusCode !== 200 || !fallbackRes.body.includes('<title>MCSPanel</title>')) {
    throw new Error('SPA fallback did not return index.html');
  }
  console.log('SPA fallback verified.');

  await app.close();
  closeDb();

  try {
    if (fs.existsSync(config.DB_PATH)) fs.unlinkSync(config.DB_PATH);
  } catch {}

  console.log('\n==========================================');
  console.log('  ALL PHASE 4 INTEGRATION TESTS PASSED!   ');
  console.log('==========================================\n');
}

runPhase4Tests().catch((err) => {
  console.error('Phase 4 Test failed:', err);
  process.exit(1);
});
