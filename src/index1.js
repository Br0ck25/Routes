// src/index.js

function withCors(resp, req) {
	const allowedOrigins = ['https://gorouteyourself.com', 'https://betaroute.brocksville.com'];
	const origin = req.headers.get('Origin');
	if (allowedOrigins.includes(origin)) {
		resp.headers.set('Access-Control-Allow-Origin', origin);
	}
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

export default {
	async fetch(request, env, ctx) {
		try {
			const url = new URL(request.url);
			const { pathname } = url;

			const ADMIN_KEY = env.ADMIN_TOKEN || 'my-super-secret-token';
			const isAdmin = (req) => req.headers.get('authorization') === `Bearer ${ADMIN_KEY}`;

			if (request.method === 'OPTIONS') {
				return withCors(new Response(null, { status: 204 }), request);
			}

			const json = async () => await request.json().catch(() => ({}));
			const getUserKey = (username) => `user:${username}`;
			const getLogsKey = (token) => `logs:${token}`;

			// 🔐 Admin: List users
			if (pathname === '/admin/users' && request.method === 'GET') {
				if (!isAdmin(request)) return withCors(new Response('Unauthorized', { status: 401 }), request);

				const list = await env.LOGS_KV.list({ prefix: 'user:' });
				const users = [];

				for (const key of list.keys) {
					try {
						const value = await env.LOGS_KV.get(key.name, { type: 'json' });
						if (value && typeof value === 'object') {
							const token = value.token;
							const logsRaw = await env.LOGS_KV.get(`logs:${token}`);
							const logs = logsRaw ? JSON.parse(logsRaw) : [];
							users.push({
								username: value.username || key.name.replace('user:', ''),
								resetKey: value.resetKey || '(none)',
								createdAt: value.createdAt || '',
								method: value.google ? 'Google' : 'Manual',
								disabled: !!value.disabled,
								logCount: logs.length,
								token: value.token || '',
							});
						}
					} catch (err) {
						console.warn(`Skipping malformed user: ${key.name}`);
					}
				}

				return withCors(Response.json(users), request);
			}

			// 🔐 Admin: Perform actions on user
			if (pathname === '/admin/actions' && request.method === 'POST') {
				if (!isAdmin(request)) return withCors(new Response('Unauthorized', { status: 401 }), request);

				const { action, username, newPassword } = await json();
				const userKey = getUserKey(username);
				const user = await env.LOGS_KV.get(userKey, { type: 'json' });
				if (!user) return withCors(new Response('User not found', { status: 404 }), request);

				let updated = false;

				if (action === 'reset-key') {
					user.resetKey = crypto.randomUUID();
					updated = true;
				} else if (action === 'reset-token') {
					user.token = crypto.randomUUID();
					updated = true;
				} else if (action === 'toggle-disabled') {
					user.disabled = !user.disabled;
					updated = true;
				} else if (action === 'reset-password' && newPassword) {
					user.password = await hashPassword(newPassword);
					updated = true;
				} else if (action === 'delete') {
					await env.LOGS_KV.delete(userKey);
					await env.LOGS_KV.delete(getLogsKey(user.token));
					return withCors(Response.json({ status: 'deleted' }), request);
				}

				if (updated) {
					await env.LOGS_KV.put(userKey, JSON.stringify(user));
					return withCors(Response.json({ status: 'updated', user }), request);
				}

				return withCors(new Response('No changes made', { status: 400 }), request);
			}

			// 🧑 User: Sign up
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
						username,
						password: hashedPassword,
						token,
						resetKey,
						createdAt: new Date().toISOString(),
					})
				);

				return withCors(Response.json({ token, resetKey }), request);
			}

			// 🧑 User: Login
			if (pathname === '/api/login' && request.method === 'POST') {
				const { username, password } = await json();
				const userKey = getUserKey(username);
				const data = await env.LOGS_KV.get(userKey);
				if (!data) return withCors(new Response('User not found', { status: 404 }), request);
				const user = JSON.parse(data);
				if (user.disabled) {
					return withCors(new Response('Account disabled', { status: 403 }), request);
				}

				const hashed = await hashPassword(password);

				if (user.password === password) {
					user.password = hashed;
					await env.LOGS_KV.put(userKey, JSON.stringify(user));
				}

				if (user.password !== hashed) {
					return withCors(new Response('Invalid password', { status: 403 }), request);
				}

				return withCors(Response.json({ token: user.token }), request);
			}

			// 🧑 User: Change password
			if (pathname === '/api/change-password' && request.method === 'POST') {
				const { username, currentPassword, newPassword } = await json();
				const userKey = getUserKey(username);
				const data = await env.LOGS_KV.get(userKey);
				if (!data) return withCors(new Response('User not found', { status: 404 }), request);
				const user = JSON.parse(data);
				if (user.disabled) {
					return withCors(new Response('Account disabled', { status: 403 }), request);
				}

				const token = request.headers.get('Authorization');
				const hashedCurrent = await hashPassword(currentPassword);

				if (user.token !== token || user.password !== hashedCurrent) {
					return withCors(new Response('Unauthorized', { status: 403 }), request);
				}

				user.password = await hashPassword(newPassword);
				await env.LOGS_KV.put(userKey, JSON.stringify(user));
				return withCors(new Response('Password changed'), request);
			}

			// 🧑 User: Reset password with reset key
			if (pathname === '/api/reset-password' && request.method === 'POST') {
				const { username, resetKey, newPassword } = await json();
				const userKey = getUserKey(username);
				const data = await env.LOGS_KV.get(userKey);
				if (!data) return withCors(new Response('User not found', { status: 404 }), request);
				const user = JSON.parse(data);
				if (user.disabled) {
					return withCors(new Response('Account disabled', { status: 403 }), request);
				}

				if (user.resetKey !== resetKey) return withCors(new Response('Invalid reset key', { status: 403 }), request);
				user.password = await hashPassword(newPassword);
				await env.LOGS_KV.put(userKey, JSON.stringify(user));
				return withCors(new Response('Password reset'), request);
			}

			// 🧑 User: Delete account
			if (pathname === '/api/delete-account' && request.method === 'POST') {
				const { username, password } = await json();
				const userKey = getUserKey(username);
				const data = await env.LOGS_KV.get(userKey);
				if (!data) return withCors(new Response('User not found', { status: 404 }), request);
				const user = JSON.parse(data);
				if (user.disabled) {
					return withCors(new Response('Account disabled', { status: 403 }), request);
				}

				const token = request.headers.get('Authorization');
				const hashedPassword = await hashPassword(password);

				if (user.token !== token || user.password !== hashedPassword) {
					return withCors(new Response('Unauthorized', { status: 403 }), request);
				}

				await env.LOGS_KV.delete(userKey);
				await env.LOGS_KV.delete(getLogsKey(user.token));
				return withCors(new Response('Account deleted'), request);
			}

			// 🧾 GET /logs — User or admin impersonation
			if (pathname === '/logs' && request.method === 'GET') {
				const authHeader = request.headers.get('Authorization') || '';
				const token = authHeader.replace('Bearer ', '').trim();
				if (!token) return withCors(new Response('Missing token', { status: 401 }), request);

				// ✅ Check if user is disabled
				const list = await env.LOGS_KV.list({ prefix: 'user:' });
				for (const key of list.keys) {
					const value = await env.LOGS_KV.get(key.name, { type: 'json' });
					if (value?.token === token && value.disabled) {
						return withCors(new Response('Account disabled', { status: 403 }), request);
					}
				}

				// ✅ Validate and return logs
				const raw = await env.LOGS_KV.get(getLogsKey(token));
				let safeLogs = '[]';

				try {
					if (raw) {
						JSON.parse(raw); // Validate
						safeLogs = raw;
					}
				} catch (err) {
					console.warn('⚠️ Corrupted logs in KV for token:', token, '→ returning empty array');
					// optional: await env.LOGS_KV.delete(getLogsKey(token)); // purge bad log if you want
				}

				return withCors(
					new Response(safeLogs, {
						headers: { 'Content-Type': 'application/json' },
					}),
					request
				);
			}

			// 🧾 POST /logs — Save logs for a user
			if (pathname === '/logs' && request.method === 'POST') {
				const authHeader = request.headers.get('Authorization') || '';
				const token = authHeader.replace('Bearer ', '').trim();
				if (!token) return withCors(new Response('Missing token', { status: 401 }), request);

				// ✅ Find user by token and check if disabled
				const list = await env.LOGS_KV.list({ prefix: 'user:' });
				for (const key of list.keys) {
					const value = await env.LOGS_KV.get(key.name, { type: 'json' });
					if (value?.token === token && value.disabled) {
						return withCors(new Response('Account disabled', { status: 403 }), request);
					}
				}

				// ✅ Save logs if not disabled
				const body = await request.text();

				try {
					const parsed = JSON.parse(body);
					if (!Array.isArray(parsed)) {
						return withCors(new Response('Invalid log format: expected array', { status: 400 }), request);
					}
				} catch (err) {
					return withCors(new Response('Invalid JSON in logs', { status: 400 }), request);
				}

				await env.LOGS_KV.put(getLogsKey(token), body);
				return withCors(new Response('Logs saved'), request);
			}

			if (pathname === '/' || pathname === '/index.html') {
				const html = await env.ASSETS.get('index.html');
				if (!html) return new Response('index.html not found', { status: 404 });

				const headers = new Headers({ 'Content-Type': 'text/html; charset=utf-8' });
				headers.set('Cache-Control', 'no-store');
				headers.delete('Cross-Origin-Opener-Policy');
				headers.delete('Cross-Origin-Embedder-Policy');

				return new Response(html, { headers });
			}

			const staticAsset = await env.ASSETS.get(pathname.slice(1));
			if (staticAsset) {
				let contentType = 'application/octet-stream';
				if (pathname.endsWith('.html')) contentType = 'text/html; charset=utf-8';
				else if (pathname.endsWith('.json')) contentType = 'application/json';
				else if (pathname.endsWith('.png')) contentType = 'image/png';
				else if (pathname.endsWith('.svg')) contentType = 'image/svg+xml';
				else if (pathname.endsWith('.js')) contentType = 'application/javascript';

				const headers = new Headers({ 'Content-Type': contentType });

				if (contentType.startsWith('text/html')) {
					headers.set('Cache-Control', 'no-store');
					headers.delete('Cross-Origin-Opener-Policy');
					headers.delete('Cross-Origin-Embedder-Policy');
				}

				return new Response(staticAsset, { headers });
			}

			if (pathname === '/debug/dump-bad-kv') {
				const results = [];

				const list = await env.LOGS_KV.list();
				for (const key of list.keys) {
					const value = await env.LOGS_KV.get(key.name);
					if (value && value.trim().startsWith('YLLpL075bj')) {
						results.push({ key: key.name, value });
					}
				}

				return new Response(JSON.stringify(results, null, 2), {
					headers: { 'Content-Type': 'application/json' },
				});
			}

			if (pathname === '/admin/fix-user' && request.method === 'POST') {
				if (!isAdmin(request)) return new Response('Unauthorized', { status: 401 });
				const { key, password, token, resetKey } = await json();

				const hashed = await hashPassword(password);

				const user = {
					username: key.replace('user:', ''),
					password: hashed,
					token,
					resetKey: resetKey || crypto.randomUUID(),
					createdAt: new Date().toISOString(),
				};

				await env.LOGS_KV.put(key, JSON.stringify(user));
				return new Response('✅ User fixed');
			}

			if (pathname === '/admin/fixable-users' && request.method === 'GET') {
				if (!isAdmin(request)) return new Response('Unauthorized', { status: 401 });

				const results = [];

				const list = await env.LOGS_KV.list({ prefix: 'user:' });
				for (const key of list.keys) {
					try {
						const val = await env.LOGS_KV.get(key.name);
						if (!val || val === 'null') continue; // 🧼 Skip truly deleted/null entries

						const parsed = JSON.parse(val);
						if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
							throw new Error('Not a valid user object');
						}
					} catch (err) {
						// It's a malformed entry — likely a password string
						const tokenGuess = key.name.replace('user:', '');
						const possibleLogs = await env.LOGS_KV.list({ prefix: 'logs:' });
						let match = possibleLogs.keys.find((k) => k.name.endsWith(tokenGuess));
						results.push({
							key: key.name,
							password: await env.LOGS_KV.get(key.name),
							token: match ? match.name.replace('logs:', '') : null,
						});
					}
				}

				return withCors(
					new Response(JSON.stringify(results), {
						headers: { 'Content-Type': 'application/json' },
					}),
					request
				);
			}

			return withCors(new Response('Not found', { status: 404 }), request);
		} catch (err) {
			return withCors(
				Response.json(
					{
						error: 'Internal Server Error',
						message: err.message,
						stack: err.stack,
					},
					{ status: 500 }
				),
				request
			);
		}
	},
};
