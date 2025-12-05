~~~{"variant":"standard","id":"48320"}
/* src/index.js
   Upgraded Worker: soft-delete, admin restore, R2 backups, scheduled export.
   - Requires: LOGS_KV (KV), ASSETS (KV), MYTRAILMAPS_BUCKET (R2)
   - Requires an ADMIN_TOKEN env variable (secret). 
*/

function withCors(resp, req) {
  const allowedOrigins = ['https://gorouteyourself.com', 'https://betaroute.brocksville.com', 'https://logs.gorouteyourself.com'];
  const origin = req.headers.get('Origin');
  if (allowedOrigins.includes(origin)) resp.headers.set('Access-Control-Allow-Origin', origin);
  resp.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  resp.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  resp.headers.set('Access-Control-Max-Age', '86400');
  return resp;
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function iterateAllKeys(namespace, options = {}) {
  // returns array of {name}
  const results = [];
  let cursor;
  do {
    const page = await namespace.list({ ...options, cursor, limit: 1000 });
    results.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
    if (!cursor) break;
  } while (cursor);
  return results;
}

async function exportKVToJson(env) {
  // returns an object mapping keys -> values (stringified)
  const result = {};
  // list all keys in LOGS_KV
  let cursor;
  do {
    const page = await env.LOGS_KV.list({ limit: 1000, cursor });
    for (const k of page.keys) {
      // fetch values (string)
      // avoid very large memory usage by streaming if necessary; for now we fetch
      const v = await env.LOGS_KV.get(k.name);
      result[k.name] = v;
    }
    cursor = page.list_complete ? undefined : page.cursor;
    if (!cursor) break;
  } while (cursor);
  return result;
}

async function putToR2(env, filename, bodyString) {
  // Save as UTF-8 JSON to R2; overwrite if exists
  await env.MYTRAILMAPS_BUCKET.put(filename, bodyString, {
    httpMetadata: { contentType: 'application/json' },
  });
}

// Helper: soft-delete a user object and logs
async function softDeleteUser(env, username) {
  const userKey = `user:${username}`;
  const userData = await env.LOGS_KV.get(userKey);
  if (!userData) return false;

  const user = JSON.parse(userData);
  const timestamp = Date.now();
  // store snapshot under deleted:user:<username>:<ts>
  const deletedKey = `deleted:user:${username}:${timestamp}`;
  await env.LOGS_KV.put(deletedKey, userData);

  // mark user record as deleted (don't remove)
  user.deleted = true;
  user.deletedAt = new Date().toISOString();
  await env.LOGS_KV.put(userKey, JSON.stringify(user));

  // also snapshot logs (if present) but do not delete them immediately
  if (user.token) {
    const logsKey = `logs:${user.token}`;
    const logs = await env.LOGS_KV.get(logsKey);
    if (logs) {
      const deletedLogsKey = `deleted:logs:${user.token}:${timestamp}`;
      await env.LOGS_KV.put(deletedLogsKey, logs);
      // optionally mark live logs as deleted flag inside value (non-destructive)
      try {
        let parsed = JSON.parse(logs);
        if (typeof parsed === 'object' && parsed !== null) {
          parsed.__deleted = true;
          parsed.__deletedAt = new Date().toISOString();
          await env.LOGS_KV.put(logsKey, JSON.stringify(parsed));
        }
      } catch (e) {
        // logs not JSON or other issue; keep them as-is
      }
    }
  }
  return true;
}

// Helper: restore user from deleted snapshot
async function restoreUserFromDeleted(env, username, deletedKeyName = null) {
  // If deletedKeyName supplied, restore that snapshot; otherwise restore latest deleted:user:<username>:*
  const prefix = `deleted:user:${username}:`;
  let candidate;
  if (deletedKeyName) {
    candidate = deletedKeyName;
  } else {
    // list and choose the latest by timestamp suffix
    const listing = await env.LOGS_KV.list({ prefix });
    if (!listing.keys.length) return false;
    candidate = listing.keys
      .map(k => k.name)
      .sort()
      .pop(); // last (largest timestamp)
  }

  const snapshot = await env.LOGS_KV.get(candidate);
  if (!snapshot) return false;
  // put snapshot back into live user key
  const userKey = `user:${username}`;
  await env.LOGS_KV.put(userKey, snapshot);

  // also try to restore logs snapshot if present (deleted:logs:<token>:ts)
  const parsedUser = JSON.parse(snapshot);
  if (parsedUser.token) {
    const logsPrefix = `deleted:logs:${parsedUser.token}:`;
    const logsList = await env.LOGS_KV.list({ prefix: logsPrefix });
    if (logsList.keys.length) {
      const logsCandidate = logsList.keys.map(k => k.name).sort().pop();
      const logsSnapshot = await env.LOGS_KV.get(logsCandidate);
      if (logsSnapshot) {
        await env.LOGS_KV.put(`logs:${parsedUser.token}`, logsSnapshot);
      }
    }
  }

  // Optionally keep the deleted snapshot (so you can do multiple restores) - we will keep it.
  return true;
}

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const { pathname } = url;

      if (request.method === 'OPTIONS') {
        return withCors(new Response(null, { status: 204 }), request);
      }

      const json = async () => await request.json().catch(() => ({}));
      const getUserKey = (username) => `user:${username}`;
      const getLogsKey = (token) => `logs:${token}`;

      // -------------------------
      // Auth / Signup / Login
      // -------------------------
      if (pathname === '/api/signup' && request.method === 'POST') {
        const { username, password } = await json();
        const userKey = getUserKey(username);
        if (await env.LOGS_KV.get(userKey)) {
          return withCors(Response.json({ error: 'That username is already taken. Please choose another.' }, { status: 400 }), request);
        }

        const token = crypto.randomUUID();
        const resetKey = crypto.randomUUID();
        const hashedPassword = await hashPassword(password);
        await env.LOGS_KV.put(
          userKey,
          JSON.stringify({
            password: hashedPassword,
            token,
            resetKey,
            createdAt: new Date().toISOString(),
          })
        );

        return withCors(Response.json({ token, resetKey }), request);
      }

      if (pathname === '/api/login' && request.method === 'POST') {
        const { username, password } = await json();
        const userKey = getUserKey(username);
        const data = await env.LOGS_KV.get(userKey);
        if (!data) {
          return withCors(new Response('User not found', { status: 404 }), request);
        }

        const user = JSON.parse(data);
        const hashedPassword = await hashPassword(password);

        // Auto-upgrade from plaintext if needed
        if (user.password === password) {
          user.password = hashedPassword;
          await env.LOGS_KV.put(userKey, JSON.stringify(user));
        }

        if (user.password !== hashedPassword) {
          return withCors(new Response('Invalid password', { status: 403 }), request);
        }

        return withCors(Response.json({ token: user.token }), request);
      }

      if (pathname === '/api/change-password' && request.method === 'POST') {
        const { username, currentPassword, newPassword } = await json();
        const userKey = getUserKey(username);
        const data = await env.LOGS_KV.get(userKey);
        if (!data) {
          return withCors(new Response('User not found', { status: 404 }), request);
        }

        const user = JSON.parse(data);
        const token = request.headers.get('Authorization');
        const hashedCurrent = await hashPassword(currentPassword);

        if (user.token !== token || (user.password !== currentPassword && user.password !== hashedCurrent)) {
          return withCors(new Response('Unauthorized', { status: 403 }), request);
        }

        user.password = await hashPassword(newPassword);
        await env.LOGS_KV.put(userKey, JSON.stringify(user));
        return withCors(new Response('Password changed'), request);
      }

      if (pathname === '/api/reset-password' && request.method === 'POST') {
        const { username, resetKey, newPassword } = await json();
        const userKey = getUserKey(username);
        const data = await env.LOGS_KV.get(userKey);
        if (!data) return withCors(new Response('User not found', { status: 404 }), request);
        const user = JSON.parse(data);
        if (user.resetKey !== resetKey) return withCors(new Response('Invalid reset key', { status: 403 }), request);
        user.password = await hashPassword(newPassword);
        await env.LOGS_KV.put(userKey, JSON.stringify(user));
        return withCors(new Response('Password reset'), request);
      }

      // -------------------------
      // DELETE ACCOUNT -> SOFT DELETE now
      // -------------------------
      if (pathname === '/api/delete-account' && request.method === 'POST') {
        const { username, password } = await json();
        const userKey = getUserKey(username);
        const data = await env.LOGS_KV.get(userKey);
        if (!data) return withCors(new Response('User not found', { status: 404 }), request);
        const user = JSON.parse(data);
        const token = request.headers.get('Authorization');
        const hashedPassword = await hashPassword(password);

        if (user.token !== token || user.password !== hashedPassword) {
          return withCors(new Response('Unauthorized', { status: 403 }), request);
        }

        // Soft-delete: snapshot and mark deleted (do NOT permanently delete)
        await softDeleteUser(env, username);
        return withCors(new Response('Account soft-deleted (recycle bin)'), request);
      }

      // -------------------------
      // LOGS endpoints (save and load)
      // -------------------------
      if (pathname === '/logs' && request.method === 'GET') {
        const token = request.headers.get('Authorization');
        if (!token) return withCors(new Response('Missing token', { status: 401 }), request);
        const logs = await env.LOGS_KV.get(getLogsKey(token));
        return withCors(
          new Response(logs || '[]', {
            headers: { 'Content-Type': 'application/json' },
          }),
          request
        );
      }

      if (pathname === '/logs' && request.method === 'POST') {
        const token = request.headers.get('Authorization');
        if (!token) return withCors(new Response('Missing token', { status: 401 }), request);
        const body = await request.text();
        await env.LOGS_KV.put(getLogsKey(token), body);
        return withCors(new Response('Logs saved'), request);
      }

      // -------------------------
      // Serve index.html from ASSETS (unchanged)
      // -------------------------
      if (pathname === '/' || pathname === '/index.html') {
        const html = await env.ASSETS.get('index.html');
        if (!html) return new Response('index.html not found', { status: 404 });

        const resp = new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });

        // Optional: remove these headers if needed (only if they exist)
        resp.headers.delete('Cross-Origin-Opener-Policy');
        resp.headers.delete('Cross-Origin-Embedder-Policy');

        return withCors(resp, request);
      }

      // -------------------------
      // Admin: list users (existing)
      // -------------------------
      if (pathname === '/admin/users' && request.method === 'GET') {
        if (url.searchParams.get('adminToken') !== env.ADMIN_TOKEN) {
          return new Response('Unauthorized', { status: 403 });
        }
        const list = await env.LOGS_KV.list({ prefix: 'user:' });
        const users = list.keys.map((k) => k.name.replace(/^user:/, ''));
        const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Admin — Users</title></head><body>
<h1>Admin — Registered Users</h1>
<pre>${JSON.stringify(users, null, 2)}</pre>
</body></html>`;
        return new Response(html, { headers: { 'Content-Type': 'text/html' } });
      }

      // -------------------------
      // Admin: POST actions (delete -> now soft-delete; reset-password)
      // -------------------------
      if (pathname === '/admin/users' && request.method === 'POST') {
        if (url.searchParams.get('adminToken') !== env.ADMIN_TOKEN) {
          return new Response('Unauthorized', { status: 403 });
        }

        const { action, username, tempPassword } = await json();
        const userKey = `user:${username}`;
        const userData = await env.LOGS_KV.get(userKey);
        if (!userData) return new Response('User not found', { status: 404 });

        const user = JSON.parse(userData);

        if (action === 'delete') {
          // Soft-delete instead of permanent delete
          await softDeleteUser(env, username);
          return new Response('✅ User soft-deleted (snapshot kept).');
        }

        if (action === 'reset-password') {
          if (!tempPassword) return new Response('Missing tempPassword', { status: 400 });
          user.password = await hashPassword(tempPassword);
          await env.LOGS_KV.put(userKey, JSON.stringify(user));
          return new Response('✅ Password reset.');
        }

        return new Response('Unknown action', { status: 400 });
      }

      // -------------------------
      // Admin: list deleted snapshots
      // GET /admin/deleted?adminToken=...
      // -------------------------
      if (pathname === '/admin/deleted' && request.method === 'GET') {
        if (url.searchParams.get('adminToken') !== env.ADMIN_TOKEN) {
          return new Response('Unauthorized', { status: 403 });
        }
        const list = await env.LOGS_KV.list({ prefix: 'deleted:' });
        // show top-level keys
        const keys = list.keys.map(k => k.name);
        return new Response(JSON.stringify(keys, null, 2), { headers: { 'Content-Type': 'application/json' } });
      }

      // -------------------------
      // Admin: restore user
      // POST /admin/restore with { username, deletedKey? } and adminToken
      // -------------------------
      if (pathname === '/admin/restore' && request.method === 'POST') {
        if (url.searchParams.get('adminToken') !== env.ADMIN_TOKEN) {
          return new Response('Unauthorized', { status: 403 });
        }
        const { username, deletedKey } = await json();
        if (!username) return new Response('Missing username', { status: 400 });
        const ok = await restoreUserFromDeleted(env, username, deletedKey || null);
        if (!ok) return new Response('Restore failed or snapshot not found', { status: 404 });
        return new Response('✅ Restore successful');
      }

      // -------------------------
      // Admin: export now (save a snapshot to R2)
      // GET /admin/export?adminToken=...
      // -------------------------
      if (pathname === '/admin/export' && request.method === 'GET') {
        if (url.searchParams.get('adminToken') !== env.ADMIN_TOKEN) {
          return new Response('Unauthorized', { status: 403 });
        }
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `logs-${timestamp}.json`;
        const exportObj = await exportKVToJson(env);
        await putToR2(env, filename, JSON.stringify(exportObj, null, 2));
        return new Response(`Exported to R2 as ${filename}`);
      }

      // -------------------------
      // Admin: backup-now (same as export) - POST
      // POST /admin/backup-now with adminToken
      // -------------------------
      if (pathname === '/admin/backup-now' && request.method === 'POST') {
        if (url.searchParams.get('adminToken') !== env.ADMIN_TOKEN) {
          return new Response('Unauthorized', { status: 403 });
        }
        const timestamp = new Date().toISOString().split('T')[0];
        const filename = `logs-${timestamp}.json`;
        const exportObj = await exportKVToJson(env);
        await putToR2(env, filename, JSON.stringify(exportObj, null, 2));
        return new Response(`Backup written to R2 as ${filename}`);
      }

      // If no route matched:
      return new Response('Not Found', { status: 404 });
    } catch (err) {
      return new Response(err.stack || err.message || String(err), { status: 500 });
    }
  },

  // scheduled handler for automated daily backups
  async scheduled(event, env, ctx) {
    // This runs when you add a Cron Trigger in Worker settings (e.g., "0 3 * * *")
    try {
      const date = new Date().toISOString().split('T')[0];
      const filename = `logs-${date}.json`;
      const exportObj = await exportKVToJson(env);
      await putToR2(env, filename, JSON.stringify(exportObj, null, 2));
    } catch (e) {
      // scheduled jobs should not throw unhandled errors
      console.error('Scheduled backup failed:', e);
    }
  }
};
