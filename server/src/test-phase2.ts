import os from 'os';
import path from 'path';
import crypto from 'crypto';

// Use isolated temporary database for test
process.env.DB_PATH = path.join(os.tmpdir(), `mcspanel_test_p2_${crypto.randomBytes(4).toString('hex')}.db`);

import { buildApp } from './app';
import { getDb, closeDb } from './db';
import { config } from './config';
import fs from 'fs';

async function runPhase2Tests() {
  console.log('--- Starting Phase 2 Integration Tests ---');
  const testDbPath = path.join(os.tmpdir(), `mcspanel_test_p2_${Date.now()}_${crypto.randomBytes(3).toString('hex')}.db`);
  console.log('Testing DB Path:', testDbPath);

  const db = getDb(testDbPath);
  const app = buildApp();
  await app.ready();

  // 1. Initial Setup: Create Admin
  console.log('\n[Test 1] Initial admin setup...');
  const setupRes = await app.inject({
    method: 'POST',
    url: '/api/setup/init',
    payload: {
      username: 'admin',
      password: 'AdminPassword123!'
    }
  });
  if (setupRes.statusCode !== 201) throw new Error(`Setup failed: ${setupRes.body}`);
  const adminData = setupRes.json();
  const adminToken = adminData.token;
  console.log('Admin created successfully.');

  // 2. Auth: Login with valid credentials
  console.log('\n[Test 2] Login with valid admin credentials...');
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'admin',
      password: 'AdminPassword123!'
    }
  });
  if (loginRes.statusCode !== 200) throw new Error(`Login failed: ${loginRes.body}`);
  const loginJson = loginRes.json();
  if (!loginJson.token || loginJson.user.username !== 'admin') throw new Error('Token missing in login response');
  console.log('Login successful.');

  // 3. Auth: Login with wrong password
  console.log('\n[Test 3] Login with invalid password...');
  const wrongLoginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'admin',
      password: 'WrongPassword'
    }
  });
  if (wrongLoginRes.statusCode !== 401) throw new Error('Wrong password should return 401');
  console.log('Wrong password rejected as expected (401).');

  // 4. Auth: /api/auth/me
  console.log('\n[Test 4] /api/auth/me with Bearer token...');
  const meRes = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: {
      authorization: `Bearer ${adminToken}`
    }
  });
  if (meRes.statusCode !== 200 || meRes.json().user.username !== 'admin') {
    throw new Error('Failed to retrieve user info via /api/auth/me');
  }
  console.log('/api/auth/me verified.');

  // 5. Admin creates a standard user
  console.log('\n[Test 5] Admin creates standard user...');
  const createUserRes = await app.inject({
    method: 'POST',
    url: '/api/users',
    headers: {
      authorization: `Bearer ${adminToken}`
    },
    payload: {
      username: 'moderator1',
      password: 'ModPassword123!',
      isAdmin: false
    }
  });
  if (createUserRes.statusCode !== 201) throw new Error(`Create user failed: ${createUserRes.body}`);
  const standardUser = createUserRes.json().user;
  console.log('Standard user created:', standardUser.username);

  // 6. Standard user logs in
  console.log('\n[Test 6] Standard user login...');
  const modLoginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'moderator1',
      password: 'ModPassword123!'
    }
  });
  if (modLoginRes.statusCode !== 200) throw new Error('Mod login failed');
  const modToken = modLoginRes.json().token;
  console.log('Standard user logged in successfully.');

  // 7. Standard user tries to access /api/users (Should be 403 Forbidden)
  console.log('\n[Test 7] Standard user attempts to list users (should be 403 Forbidden)...');
  const modAccessUsersRes = await app.inject({
    method: 'GET',
    url: '/api/users',
    headers: {
      authorization: `Bearer ${modToken}`
    }
  });
  if (modAccessUsersRes.statusCode !== 403) {
    throw new Error(`Expected 403 Forbidden for non-admin, got ${modAccessUsersRes.statusCode}`);
  }
  console.log('Non-admin correctly denied access (403 Forbidden).');

  // 8. Admin updates standard user password
  console.log('\n[Test 8] Admin updates user password...');
  const updateRes = await app.inject({
    method: 'PUT',
    url: `/api/users/${standardUser.id}`,
    headers: {
      authorization: `Bearer ${adminToken}`
    },
    payload: {
      password: 'NewModPassword456!'
    }
  });
  if (updateRes.statusCode !== 200) throw new Error(`Update failed: ${updateRes.body}`);

  // Test login with new password
  const newLoginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      username: 'moderator1',
      password: 'NewModPassword456!'
    }
  });
  if (newLoginRes.statusCode !== 200) throw new Error('Login with updated password failed');
  console.log('Password update and re-login verified.');

  // 9. Admin assigns permissions for an instance to user
  console.log('\n[Test 9] Setting instance permissions for user...');
  const dummyInstanceId = 'dummy-server-1';
  db.prepare(`
    INSERT INTO instances (id, name, directory_path, start_command, cached_port, auto_restart, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).run(dummyInstanceId, 'Test Survival Server', 'C:\\Servers\\Survival', 'java -jar server.jar', 25565, new Date().toISOString(), new Date().toISOString());

  const permRes = await app.inject({
    method: 'PUT',
    url: `/api/users/${standardUser.id}/permissions/${dummyInstanceId}`,
    headers: {
      authorization: `Bearer ${adminToken}`
    },
    payload: {
      canViewConsole: true,
      canSendCommands: false,
      canStart: true,
      canStop: true,
      canRestart: true,
      canKill: false,
      canEditConfig: false
    }
  });
  if (permRes.statusCode !== 200) throw new Error(`Permission set failed: ${permRes.body}`);
  const permData = permRes.json().permission;
  if (!permData.canStart || permData.canKill) throw new Error('Permission flags do not match');
  console.log('Permissions successfully stored.');

  // 9b. Partial permission update: updating canKill to true should NOT reset canStart or canStop!
  console.log('\n[Test 9b] Partial permission update (preserving other flags)...');
  const partialPermRes = await app.inject({
    method: 'PUT',
    url: `/api/users/${standardUser.id}/permissions/${dummyInstanceId}`,
    headers: { authorization: `Bearer ${adminToken}` },
    payload: { canKill: true }
  });
  if (partialPermRes.statusCode !== 200) throw new Error('Partial perm update failed');
  const updatedPerm = partialPermRes.json().permission;
  if (!updatedPerm.canStart || !updatedPerm.canStop || !updatedPerm.canKill) {
    throw new Error('Partial permission update incorrectly reset other permissions!');
  }
  console.log('Partial permission update verified: existing flags preserved.');

  // 9c. Test /api/instances/:id/users endpoint
  console.log('\n[Test 9c] Getting instance users permissions...');
  const instUsersRes = await app.inject({
    method: 'GET',
    url: `/api/instances/${dummyInstanceId}/users`,
    headers: { authorization: `Bearer ${adminToken}` }
  });
  if (instUsersRes.statusCode !== 200) throw new Error('Instance users failed');
  const instUsersList = instUsersRes.json().users;
  if (!Array.isArray(instUsersList) || instUsersList.length === 0) throw new Error('Expected instance users');
  console.log('Instance users permissions endpoint verified.');

  // 10. User reads own permissions
  console.log('\n[Test 10] User reads own permissions...');
  const userPermsRes = await app.inject({
    method: 'GET',
    url: `/api/users/${standardUser.id}/permissions`,
    headers: {
      authorization: `Bearer ${modToken}`
    }
  });
  if (userPermsRes.statusCode !== 200) throw new Error('User read permissions failed');
  const userPermsList = userPermsRes.json().permissions;
  if (userPermsList.length !== 1 || userPermsList[0].instanceId !== dummyInstanceId) {
    throw new Error('User permission list mismatch');
  }
  console.log('User successfully read own permissions.');

  // 11. Admin attempts to delete own account (Must be rejected)
  console.log('\n[Test 11] Admin attempts self-deletion (should fail)...');
  const selfDeleteRes = await app.inject({
    method: 'DELETE',
    url: `/api/users/${adminData.user.id}`,
    headers: {
      authorization: `Bearer ${adminToken}`
    }
  });
  if (selfDeleteRes.statusCode !== 400) throw new Error('Self deletion should return 400');
  console.log('Self-deletion prevented as expected (400).');

  // 12. Admin deletes standard user
  console.log('\n[Test 12] Admin deletes standard user...');
  const deleteUserRes = await app.inject({
    method: 'DELETE',
    url: `/api/users/${standardUser.id}`,
    headers: {
      authorization: `Bearer ${adminToken}`
    }
  });
  if (deleteUserRes.statusCode !== 200) throw new Error('Delete user failed');
  console.log('User deleted successfully.');

  await app.close();
  closeDb();

  try {
    if (fs.existsSync(config.DB_PATH)) fs.unlinkSync(config.DB_PATH);
  } catch {}

  console.log('\n==========================================');
  console.log('  ALL PHASE 2 INTEGRATION TESTS PASSED!   ');
  console.log('==========================================\n');
}

runPhase2Tests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
