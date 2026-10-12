import os from 'os';
import path from 'path';
import crypto from 'crypto';

// Use isolated temporary database for test
process.env.DB_PATH = path.join(os.tmpdir(), `mcspanel_test_p1_${crypto.randomBytes(4).toString('hex')}.db`);

import { buildApp } from './app';
import { getDb, closeDb } from './db';
import fs from 'fs';
import { config } from './config';

async function runTests() {
  console.log('--- Starting Phase 1 Integration Tests ---');
  const testDbPath = path.join(os.tmpdir(), `mcspanel_test_p1_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.db`);
  console.log('Testing DB Path:', testDbPath);

  // Initialize DB
  getDb(testDbPath);

  const app = buildApp();
  await app.ready();

  // Test 1: Health check
  console.log('\n[Test 1] Testing /api/health...');
  const healthRes = await app.inject({
    method: 'GET',
    url: '/api/health'
  });
  console.log('Status:', healthRes.statusCode);
  const healthJson = healthRes.json();
  if (healthRes.statusCode !== 200 || healthJson.status !== 'ok') {
    throw new Error('Health check failed!');
  }

  // Test 2: Setup status (Initially should be required)
  console.log('\n[Test 2] Testing /api/setup/status (initial)...');
  const setupStatusRes1 = await app.inject({
    method: 'GET',
    url: '/api/setup/status'
  });
  console.log('Status:', setupStatusRes1.statusCode);
  const setupStatusJson1 = setupStatusRes1.json();
  if (setupStatusJson1.setupRequired !== true || setupStatusJson1.isConfigured !== false) {
    throw new Error('Initial setup status check failed!');
  }

  // Test 3: Setup init validation check (short password)
  console.log('\n[Test 3] Testing /api/setup/init validation with short password...');
  const invalidInitRes = await app.inject({
    method: 'POST',
    url: '/api/setup/init',
    payload: {
      username: 'admin',
      password: '12'
    }
  });
  if (invalidInitRes.statusCode !== 400) {
    throw new Error('Validation check should have failed with 400!');
  }

  // Test 4: Setup init success
  console.log('\n[Test 4] Testing /api/setup/init valid admin creation...');
  const validInitRes = await app.inject({
    method: 'POST',
    url: '/api/setup/init',
    payload: {
      username: 'superadmin',
      password: 'AdminPassword123!'
    }
  });
  if (validInitRes.statusCode !== 201) {
    throw new Error('Admin creation failed!');
  }

  // Test 5: Setup status after creation
  console.log('\n[Test 5] Testing /api/setup/status after creation...');
  const setupStatusRes2 = await app.inject({
    method: 'GET',
    url: '/api/setup/status'
  });
  const setupStatusJson2 = setupStatusRes2.json();
  if (setupStatusJson2.setupRequired !== false || setupStatusJson2.isConfigured !== true) {
    throw new Error('Post-setup status check failed!');
  }

  // Test 6: Attempting setup init again must be rejected (403 Forbidden)
  console.log('\n[Test 6] Testing /api/setup/init second attempt (should be 403 Forbidden)...');
  const forbiddenRes = await app.inject({
    method: 'POST',
    url: '/api/setup/init',
    payload: {
      username: 'hacker',
      password: 'Password123!'
    }
  });
  if (forbiddenRes.statusCode !== 403) {
    throw new Error('Second setup attempt should have been 403 Forbidden!');
  }

  await app.close();
  closeDb();

  try {
    if (fs.existsSync(config.DB_PATH)) fs.unlinkSync(config.DB_PATH);
  } catch {}

  console.log('\n==========================================');
  console.log('  ALL PHASE 1 INTEGRATION TESTS PASSED!   ');
  console.log('==========================================\n');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
