import os from 'os';
import path from 'path';
import crypto from 'crypto';

// Use isolated temporary database for test
process.env.DB_PATH = path.join(os.tmpdir(), `mcspanel_test_p3_${crypto.randomBytes(4).toString('hex')}.db`);

import { buildApp } from './app';
import { getDb, closeDb } from './db';
import { config } from './config';
import { PropertiesParser } from './utils/propertiesParser';
import fs from 'fs';

async function runPhase3Tests() {
  console.log('--- Starting Phase 3 Integration Tests ---');
  console.log('Testing DB Path:', config.DB_PATH);

  // 1. Test PropertiesParser
  console.log('\n[Test 1] Testing PropertiesParser...');
  const sampleProperties = `
# Minecraft server properties
# Sat Oct 10 2026
server-port=25588
motd=Awesome Minecraft Server!
max-players=50
online-mode=true
level-name=world
  `;
  const parsed = PropertiesParser.parse(sampleProperties);
  if (parsed.serverPort !== 25588) throw new Error(`Expected port 25588, got ${parsed.serverPort}`);
  if (parsed.motd !== 'Awesome Minecraft Server!') throw new Error(`Unexpected motd: ${parsed.motd}`);
  if (parsed.maxPlayers !== 50) throw new Error(`Unexpected max-players: ${parsed.maxPlayers}`);
  if (parsed.onlineMode !== true) throw new Error(`Unexpected online-mode: ${parsed.onlineMode}`);
  console.log('PropertiesParser parsed server.properties successfully.');

  // Create temporary server directory for integration testing
  const tempServerDir = path.join(os.tmpdir(), `test_mc_srv_${crypto.randomBytes(4).toString('hex')}`);
  if (!fs.existsSync(tempServerDir)) {
    fs.mkdirSync(tempServerDir, { recursive: true });
  }
  fs.writeFileSync(path.join(tempServerDir, 'server.properties'), 'server-port=25599\nmotd=Mock Server\n');

  const testDbPath = path.join(os.tmpdir(), `mcspanel_test_p3_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.db`);
  getDb(testDbPath);
  const app = buildApp();
  await app.ready();

  // 2. Setup admin
  console.log('\n[Test 2] Creating Admin account...');
  const setupRes = await app.inject({
    method: 'POST',
    url: '/api/setup/init',
    payload: {
      username: 'admin',
      password: 'AdminPassword123!'
    }
  });
  if (setupRes.statusCode !== 201) throw new Error('Setup failed');
  const adminToken = setupRes.json().token;

  // 3. Add Minecraft Server Instance
  console.log('\n[Test 3] Creating mock startup script and testing detect endpoint...');
  const isWin = process.platform === 'win32';
  const scriptName = isWin ? 'start.bat' : 'start.sh';

  fs.writeFileSync(
    path.join(tempServerDir, 'mockServer.js'),
    `console.log('Starting mock server...');
setTimeout(() => console.log('Done (1.2s)! For help, type "help"'), 300);
process.stdin.on('data', (d) => {
  const s = d.toString().trim();
  if (s === 'stop') {
    console.log('Mock server stopped.');
    process.exit(0);
  } else {
    console.log('Received: ' + s);
  }
});`
  );

  if (isWin) {
    fs.writeFileSync(path.join(tempServerDir, 'start.bat'), '@echo off\r\nnode mockServer.js\r\n');
  } else {
    const shPath = path.join(tempServerDir, 'start.sh');
    fs.writeFileSync(shPath, '#!/bin/bash\nnode mockServer.js\n');
    try { fs.chmodSync(shPath, '755'); } catch {}
  }

  // Test detect endpoint
  const detectRes = await app.inject({
    method: 'POST',
    url: '/api/instances/detect',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { directoryPath: tempServerDir }
  });
  if (detectRes.statusCode !== 200) throw new Error(`Detect failed: ${detectRes.body}`);
  const detectData = detectRes.json();
  if (!detectData.selectedStartFile) throw new Error('Expected selectedStartFile to be detected');
  if (detectData.port !== 25599) throw new Error(`Expected detected port 25599, got ${detectData.port}`);
  console.log('Detect endpoint verified. Detected script:', detectData.selectedStartFile, 'Port:', detectData.port);

  // Add instance
  const addInstanceRes = await app.inject({
    method: 'POST',
    url: '/api/instances',
    headers: { authorization: `Bearer ${adminToken}` },
    payload: {
      name: 'Test Survival 1.20',
      directoryPath: tempServerDir,
      startFile: scriptName
    }
  });
  if (addInstanceRes.statusCode !== 201) throw new Error(`Add instance failed: ${addInstanceRes.body}`);
  const instance = addInstanceRes.json().instance;
  console.log('Instance created:', instance.name, 'Port automatically detected:', instance.port);
  if (instance.port !== 25599) throw new Error(`Expected port 25599 from properties, got ${instance.port}`);

  // 4. Start Server
  console.log('\n[Test 4] Starting server process...');
  const startRes = await app.inject({
    method: 'POST',
    url: `/api/instances/${instance.id}/start`,
    headers: { authorization: `Bearer ${adminToken}` }
  });
  if (startRes.statusCode !== 200) throw new Error(`Start failed: ${startRes.body}`);
  console.log('Server start request accepted.');

  // Wait 800ms for mock server to output "Done (...)" and transition to RUNNING
  await new Promise((r) => setTimeout(r, 800));

  // 5. Check status
  console.log('\n[Test 5] Checking status after start...');
  const statusRes = await app.inject({
    method: 'GET',
    url: `/api/instances/${instance.id}`,
    headers: { authorization: `Bearer ${adminToken}` }
  });
  const currentInstance = statusRes.json().instance;
  console.log('Current status:', currentInstance.status, 'PID:', currentInstance.pid);
  if (currentInstance.status !== 'RUNNING') {
    throw new Error(`Expected status RUNNING, got ${currentInstance.status}`);
  }

  // 6. Send command
  console.log('\n[Test 6] Sending command to server...');
  const cmdRes = await app.inject({
    method: 'POST',
    url: `/api/instances/${instance.id}/command`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { command: 'say Hello Antigravity!' }
  });
  if (cmdRes.statusCode !== 200) throw new Error(`Command send failed: ${cmdRes.body}`);
  console.log('Command sent.');

  await new Promise((r) => setTimeout(r, 300));

  // 7. Check logs
  console.log('\n[Test 7] Verifying console logs buffer...');
  const logsRes = await app.inject({
    method: 'GET',
    url: `/api/instances/${instance.id}/logs`,
    headers: { authorization: `Bearer ${adminToken}` }
  });
  if (logsRes.statusCode !== 200) throw new Error('Logs fetch failed');
  const logsData = logsRes.json();
  const logTexts = logsData.logs.map((l: any) => l.text).join('\n');
  if (!logTexts.includes('say Hello Antigravity!') || !logTexts.includes('Received: say Hello Antigravity!')) {
    throw new Error(`Expected command echo in logs. Got:\n${logTexts}`);
  }
  console.log('Console logs buffer verified with command echo.');

  // 8. Graceful Stop
  console.log('\n[Test 8] Graceful stop (stop command)...');
  const stopRes = await app.inject({
    method: 'POST',
    url: `/api/instances/${instance.id}/stop`,
    headers: { authorization: `Bearer ${adminToken}` }
  });
  if (stopRes.statusCode !== 200) throw new Error(`Stop failed: ${stopRes.body}`);

  await new Promise((r) => setTimeout(r, 600));

  const postStopRes = await app.inject({
    method: 'GET',
    url: `/api/instances/${instance.id}`,
    headers: { authorization: `Bearer ${adminToken}` }
  });
  const postStopStatus = postStopRes.json().instance.status;
  console.log('Status after stop:', postStopStatus);
  if (postStopStatus !== 'OFFLINE') {
    throw new Error(`Expected status OFFLINE after stop, got ${postStopStatus}`);
  }

  await app.close();
  closeDb();

  try {
    if (fs.existsSync(tempServerDir)) fs.rmSync(tempServerDir, { recursive: true, force: true });
    if (fs.existsSync(config.DB_PATH)) fs.unlinkSync(config.DB_PATH);
  } catch {}

  console.log('\n==========================================');
  console.log('  ALL PHASE 3 INTEGRATION TESTS PASSED!   ');
  console.log('==========================================\n');
}

runPhase3Tests().catch((err) => {
  console.error('Phase 3 Test failed:', err);
  process.exit(1);
});
